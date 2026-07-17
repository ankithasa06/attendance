import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db";
import { eq, ilike, and, SQL } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any).employeeId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

function requireAdmin(req: any, res: any, next: any) {
  (async () => {
    const employeeId = (req.session as any).employeeId;
    if (!employeeId) return res.status(401).json({ error: "Not authenticated" });

    const [emp] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, employeeId))
      .limit(1);

    if (!emp || emp.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  })().catch(next);
}

function mapEmployee(e: typeof employeesTable.$inferSelect) {
  return {
    id: e.id,
    name: e.name,
    email: e.email,
    employeeCode: e.employeeCode,
    department: e.department,
    role: e.role,
    isActive: e.isActive,
    hasFaceRegistered: !!(e.faceDescriptors && e.faceDescriptors.length > 0),
    createdAt: e.createdAt.toISOString(),
  };
}

// GET /api/employees
router.get("/employees", requireAuth, async (req, res) => {
  const { search, department, isActive } = req.query as {
    search?: string;
    department?: string;
    isActive?: string;
  };

  const conditions: SQL[] = [];

  if (search) {
    conditions.push(ilike(employeesTable.name, `%${search}%`));
  }
  if (department) {
    conditions.push(eq(employeesTable.department, department));
  }
  if (isActive !== undefined) {
    conditions.push(eq(employeesTable.isActive, isActive === "true"));
  }

  const employees = await db
    .select()
    .from(employeesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return res.json(employees.map(mapEmployee));
});

// POST /api/employees
router.post("/employees", requireAdmin, async (req, res) => {
  const { name, email, password, employeeCode, department, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [employee] = await db
    .insert(employeesTable)
    .values({
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      employeeCode: employeeCode || null,
      department: department || null,
      role: role || "employee",
      isActive: true,
    })
    .returning();

  return res.status(201).json(mapEmployee(employee));
});

// GET /api/employees/:id
router.get("/employees/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, id))
    .limit(1);

  if (!employee) return res.status(404).json({ error: "Employee not found" });

  return res.json(mapEmployee(employee));
});

// PATCH /api/employees/:id
router.patch("/employees/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const { name, email, employeeCode, department, role, isActive, password } = req.body;

  const updateData: Partial<typeof employeesTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email.toLowerCase().trim();
  if (employeeCode !== undefined) updateData.employeeCode = employeeCode || null;
  if (department !== undefined) updateData.department = department || null;
  if (role !== undefined) updateData.role = role;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (password) updateData.passwordHash = await bcrypt.hash(password, 12);

  const [employee] = await db
    .update(employeesTable)
    .set(updateData)
    .where(eq(employeesTable.id, id))
    .returning();

  if (!employee) return res.status(404).json({ error: "Employee not found" });

  return res.json(mapEmployee(employee));
});

// DELETE /api/employees/:id
router.delete("/employees/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  await db.delete(employeesTable).where(eq(employeesTable.id, id));

  return res.json({ message: "Employee deleted" });
});

// POST /api/employees/:id/face
router.post("/employees/:id/face", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const { descriptors } = req.body as { descriptors: number[][] };

  if (!descriptors || !Array.isArray(descriptors) || descriptors.length === 0) {
    return res.status(400).json({ error: "Face descriptors are required" });
  }

  const [employee] = await db
    .update(employeesTable)
    .set({ faceDescriptors: descriptors, updatedAt: new Date() })
    .where(eq(employeesTable.id, id))
    .returning();

  if (!employee) return res.status(404).json({ error: "Employee not found" });

  return res.json(mapEmployee(employee));
});

// DELETE /api/employees/:id/face
router.delete("/employees/:id/face", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const [employee] = await db
    .update(employeesTable)
    .set({ faceDescriptors: null, updatedAt: new Date() })
    .where(eq(employeesTable.id, id))
    .returning();

  if (!employee) return res.status(404).json({ error: "Employee not found" });

  return res.json(mapEmployee(employee));
});

export default router;
