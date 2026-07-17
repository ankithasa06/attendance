import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (!employee) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  if (!employee.isActive) {
    return res.status(401).json({ error: "Account is inactive" });
  }

  const valid = await bcrypt.compare(password, employee.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  // Store session
  (req.session as any).employeeId = employee.id;

  return res.json({
    id: employee.id,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    department: employee.department,
    employeeCode: employee.employeeCode,
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
    hasFaceRegistered: !!(employee.faceDescriptors && employee.faceDescriptors.length > 0),
  });
});

export default router;
