import { Router } from "express";
import { db } from "@workspace/db";
import { locationsTable, employeesTable, attendanceTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

function mapLocation(l: typeof locationsTable.$inferSelect) {
  return {
    id: l.id,
    name: l.name,
    address: l.address,
    latitude: l.latitude,
    longitude: l.longitude,
    radius: l.radius,
    isActive: l.isActive,
    createdAt: l.createdAt.toISOString(),
  };
}

// GET /api/locations
router.get("/locations", requireAuth, async (req, res) => {
  const locations = await db.select().from(locationsTable);
  return res.json(locations.map(mapLocation));
});

// POST /api/locations
router.post("/locations", requireAdmin, async (req, res) => {
  const { name, address, latitude, longitude, radius } = req.body;

  if (!name || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: "Name, latitude, and longitude are required" });
  }

  const [location] = await db
    .insert(locationsTable)
    .values({
      name,
      address: address || null,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      radius: radius ? parseFloat(radius) : 100,
      isActive: true,
    })
    .returning();

  return res.status(201).json(mapLocation(location));
});

// GET /api/locations/:id
router.get("/locations/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const [location] = await db
    .select()
    .from(locationsTable)
    .where(eq(locationsTable.id, id))
    .limit(1);

  if (!location) return res.status(404).json({ error: "Location not found" });

  return res.json(mapLocation(location));
});

// PATCH /api/locations/:id
router.patch("/locations/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const { name, address, latitude, longitude, radius, isActive } = req.body;

  const updateData: Partial<typeof locationsTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (name !== undefined) updateData.name = name;
  if (address !== undefined) updateData.address = address || null;
  if (latitude !== undefined) updateData.latitude = parseFloat(latitude);
  if (longitude !== undefined) updateData.longitude = parseFloat(longitude);
  if (radius !== undefined) updateData.radius = parseFloat(radius);
  if (isActive !== undefined) updateData.isActive = isActive;

  const [location] = await db
    .update(locationsTable)
    .set(updateData)
    .where(eq(locationsTable.id, id))
    .returning();

  if (!location) return res.status(404).json({ error: "Location not found" });

  return res.json(mapLocation(location));
});

// DELETE /api/locations/:id
router.delete("/locations/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  await db.update(attendanceTable).set({ locationId: null }).where(eq(attendanceTable.locationId, id));
  await db.delete(locationsTable).where(eq(locationsTable.id, id));

  return res.json({ message: "Location deleted" });
});

export default router;
