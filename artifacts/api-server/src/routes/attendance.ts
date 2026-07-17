import { Router } from "express";
import { db } from "@workspace/db";
import { attendanceTable, employeesTable, locationsTable } from "@workspace/db";
import { eq, and, gte, lte, SQL } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any).employeeId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

// Haversine formula: returns distance in meters
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Euclidean distance between two face descriptors
function faceDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));
}

function mapRecord(
  r: typeof attendanceTable.$inferSelect,
  employee?: typeof employeesTable.$inferSelect | null,
  location?: typeof locationsTable.$inferSelect | null
) {
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeName: employee?.name ?? "",
    employeeCode: employee?.employeeCode ?? null,
    department: employee?.department ?? null,
    locationId: r.locationId,
    locationName: location?.name ?? null,
    date: r.date,
    checkInTime: r.checkInTime?.toISOString() ?? null,
    checkOutTime: r.checkOutTime?.toISOString() ?? null,
    status: r.status,
    faceVerified: r.faceVerified,
    locationVerified: r.locationVerified,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  };
}

// GET /api/attendance
router.get("/attendance", requireAuth, async (req, res) => {
  const { employeeId, locationId, date, startDate, endDate, status } = req.query as Record<string, string>;

  const conditions: SQL[] = [];
  if (employeeId) conditions.push(eq(attendanceTable.employeeId, parseInt(employeeId)));
  if (locationId) conditions.push(eq(attendanceTable.locationId as any, parseInt(locationId)));
  if (date) conditions.push(eq(attendanceTable.date, date));
  if (startDate) conditions.push(gte(attendanceTable.date, startDate));
  if (endDate) conditions.push(lte(attendanceTable.date, endDate));
  if (status) conditions.push(eq(attendanceTable.status, status as any));

  const records = await db
    .select({
      attendance: attendanceTable,
      employee: employeesTable,
      location: locationsTable,
    })
    .from(attendanceTable)
    .leftJoin(employeesTable, eq(attendanceTable.employeeId, employeesTable.id))
    .leftJoin(locationsTable, eq(attendanceTable.locationId as any, locationsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return res.json(records.map((r) => mapRecord(r.attendance, r.employee, r.location)));
});

// POST /api/attendance/check-in
router.post("/attendance/check-in", requireAuth, async (req, res) => {
  const { employeeId, locationId, latitude, longitude, faceDescriptor } = req.body as {
    employeeId: number;
    locationId: number;
    latitude: number;
    longitude: number;
    faceDescriptor: number[];
  };

  // Load location
  const [location] = await db
    .select()
    .from(locationsTable)
    .where(eq(locationsTable.id, locationId))
    .limit(1);

  if (!location || !location.isActive) {
    return res.status(400).json({ error: "Location not found or inactive" });
  }

  // Geofence check
  const distance = haversineDistance(latitude, longitude, location.latitude, location.longitude);
  const locationVerified = distance <= location.radius;

  if (!locationVerified) {
    return res.status(400).json({
      error: `You are ${Math.round(distance)}m away from ${location.name}. Must be within ${location.radius}m.`,
    });
  }

  // Face verification
  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, employeeId))
    .limit(1);

  if (!employee) {
    return res.status(400).json({ error: "Employee not found" });
  }

  let faceVerified = false;
  if (employee.faceDescriptors && employee.faceDescriptors.length > 0 && faceDescriptor?.length === 128) {
    const FACE_THRESHOLD = 0.6;
    const matched = employee.faceDescriptors.some(
      (stored) => faceDistance(stored, faceDescriptor) < FACE_THRESHOLD
    );
    faceVerified = matched;
  }

  if (!faceVerified && employee.faceDescriptors && employee.faceDescriptors.length > 0) {
    return res.status(400).json({ error: "Face not recognized. Please try again or contact admin." });
  }

  // Check for existing record today
  const today = new Date().toISOString().split("T")[0];
  const [existing] = await db
    .select()
    .from(attendanceTable)
    .where(and(eq(attendanceTable.employeeId, employeeId), eq(attendanceTable.date, today)))
    .limit(1);

  if (existing) {
    return res.status(400).json({ error: "Already checked in today" });
  }

  // Determine status (late if after 9:30 AM)
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const isLate = hour > 9 || (hour === 9 && minute > 30);

  const [record] = await db
    .insert(attendanceTable)
    .values({
      employeeId,
      locationId,
      date: today,
      checkInTime: now,
      status: isLate ? "late" : "present",
      faceVerified,
      locationVerified: true,
    })
    .returning();

  return res.status(201).json(mapRecord(record, employee, location));
});

// POST /api/attendance/check-out
router.post("/attendance/check-out", requireAuth, async (req, res) => {
  const { attendanceId, latitude, longitude } = req.body as {
    attendanceId: number;
    latitude: number;
    longitude: number;
  };

  const [record] = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.id, attendanceId))
    .limit(1);

  if (!record) return res.status(400).json({ error: "Attendance record not found" });
  if (record.checkOutTime) return res.status(400).json({ error: "Already checked out" });

  const [updated] = await db
    .update(attendanceTable)
    .set({ checkOutTime: new Date(), updatedAt: new Date() })
    .where(eq(attendanceTable.id, attendanceId))
    .returning();

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, record.employeeId))
    .limit(1);

  const location = record.locationId
    ? (await db.select().from(locationsTable).where(eq(locationsTable.id, record.locationId)).limit(1))[0]
    : undefined;

  return res.json(mapRecord(updated, employee, location));
});

// GET /api/attendance/:id
router.get("/attendance/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const [result] = await db
    .select({ attendance: attendanceTable, employee: employeesTable, location: locationsTable })
    .from(attendanceTable)
    .leftJoin(employeesTable, eq(attendanceTable.employeeId, employeesTable.id))
    .leftJoin(locationsTable, eq(attendanceTable.locationId as any, locationsTable.id))
    .where(eq(attendanceTable.id, id))
    .limit(1);

  if (!result) return res.status(404).json({ error: "Record not found" });

  return res.json(mapRecord(result.attendance, result.employee, result.location));
});

// PATCH /api/attendance/:id
router.patch("/attendance/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const { status, checkInTime, checkOutTime, notes } = req.body;

  const updateData: Partial<typeof attendanceTable.$inferInsert> = { updatedAt: new Date() };
  if (status !== undefined) updateData.status = status;
  if (checkInTime !== undefined) updateData.checkInTime = new Date(checkInTime);
  if (checkOutTime !== undefined) updateData.checkOutTime = new Date(checkOutTime);
  if (notes !== undefined) updateData.notes = notes;

  const [updated] = await db
    .update(attendanceTable)
    .set(updateData)
    .where(eq(attendanceTable.id, id))
    .returning();

  if (!updated) return res.status(404).json({ error: "Record not found" });

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, updated.employeeId))
    .limit(1);

  const location = updated.locationId
    ? (await db.select().from(locationsTable).where(eq(locationsTable.id, updated.locationId)).limit(1))[0]
    : undefined;

  return res.json(mapRecord(updated, employee, location));
});

export default router;
