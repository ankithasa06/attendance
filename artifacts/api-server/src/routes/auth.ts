import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db";
import { eq, or, sql } from "drizzle-orm";

const router = Router();

// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  // Raw username trims leading/trailing spaces and iOS zero-width characters for logging
  const rawUsername = email.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  // noSpaceUsername is for aggressive matching (removes all spaces, lowercases)
  const noSpaceUsername = rawUsername.replace(/[\s\u00A0]/g, '').toLowerCase();

  console.log(`[LOGIN ATTEMPT] email/username: "${rawUsername}"`);
  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(
      or(
        eq(employeesTable.email, noSpaceUsername),
        eq(employeesTable.email, `${noSpaceUsername}@gmail.com`),
        eq(employeesTable.employeeCode, noSpaceUsername.toUpperCase()),
        sql`LOWER(REPLACE(${employeesTable.name}, ' ', '')) = ${noSpaceUsername}`
      )
    )
    .limit(1);

  if (!employee) {
    console.log(`[LOGIN FAILED] No user found for "${email}"`);
    return res.status(401).json({ error: "Invalid username or password" });
  }

  if (!employee.isActive) {
    return res.status(401).json({ error: "Account is inactive" });
  }

  let valid = await bcrypt.compare(password, employee.passwordHash);
  
  if (!valid) {
    // Fallback: iOS Safari often injects smart quotes, en-dashes, or copy-paste trailing spaces.
    // If the original raw password fails, normalize these and try again.
    const normalizedPassword = password
      .replace(/[‘’`]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/—/g, '--')
      .replace(/–/g, '-')
      .trim();
      
    if (password !== normalizedPassword) {
      valid = await bcrypt.compare(normalizedPassword, employee.passwordHash);
    }
  }

  if (!valid) {
    console.log(`[LOGIN FAILED] Invalid password for user "${employee.email}"`);
    return res.status(401).json({ error: "Invalid username or password" });
  }

  // Store session — save() explicitly so the session row is written to Postgres
  // before we respond, avoiding a race where the client's next request arrives
  // before the session store has persisted the row.
  (req.session as any).employeeId = employee.id;

  await new Promise<void>((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve()))
  );

  return res.json({
    id: employee.id,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    department: employee.department,
    employeeCode: employee.employeeCode,
    locationId: employee.locationId,
    hasFaceRegistered: !!(employee.faceDescriptors && employee.faceDescriptors.length > 0),
  });
});

// POST /api/auth/logout
router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out successfully" });
  });
});

// GET /api/auth/me
router.get("/auth/me", async (req, res) => {
  const employeeId = (req.session as any).employeeId;
  if (!employeeId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, employeeId))
    .limit(1);

  if (!employee || !employee.isActive) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  return res.json({
    id: employee.id,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    department: employee.department,
    employeeCode: employee.employeeCode,
    locationId: employee.locationId,
    hasFaceRegistered: !!(employee.faceDescriptors && employee.faceDescriptors.length > 0),
  });
});

// PUT /api/auth/update-credentials
router.put("/auth/update-credentials", async (req, res) => {
  const employeeId = (req.session as any).employeeId;
  if (!employeeId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, employeeId))
    .limit(1);

  if (!employee || !employee.isActive) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db
    .update(employeesTable)
    .set({ email: email.toLowerCase().trim(), passwordHash })
    .where(eq(employeesTable.id, employeeId));

  return res.json({ message: "Credentials updated successfully" });
});

export default router;
