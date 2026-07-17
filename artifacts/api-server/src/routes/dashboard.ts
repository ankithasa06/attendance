import { Router } from "express";
import { db } from "@workspace/db";
import { attendanceTable, employeesTable, locationsTable } from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any).employeeId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

// GET /api/dashboard/summary
router.get("/dashboard/summary", requireAuth, async (req, res) => {
  const today = todayDate();

  const [totalResult] = await db
    .select({ total: count() })
    .from(employeesTable)
    .where(eq(employeesTable.isActive, true));

  const todayRecords = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.date, today));

  const presentToday = todayRecords.filter((r) => r.status === "present").length;
  const lateToday = todayRecords.filter((r) => r.status === "late").length;
  const checkedOutToday = todayRecords.filter((r) => r.checkOutTime !== null).length;

  const totalActive = totalResult?.total ?? 0;
  const absentToday = Math.max(0, Number(totalActive) - presentToday - lateToday);
  const attendanceRate =
    totalActive > 0 ? Math.round(((presentToday + lateToday) / Number(totalActive)) * 100) : 0;

  const [activeLocations] = await db
    .select({ total: count() })
    .from(locationsTable)
    .where(eq(locationsTable.isActive, true));

  return res.json({
    totalEmployees: Number(totalActive),
    presentToday,
    absentToday,
    lateToday,
    attendanceRate,
    checkedOutToday,
    activeLocations: Number(activeLocations?.total ?? 0),
  });
});

// GET /api/dashboard/today
router.get("/dashboard/today", requireAuth, async (req, res) => {
  const today = todayDate();

  const records = await db
    .select({ attendance: attendanceTable, employee: employeesTable, location: locationsTable })
    .from(attendanceTable)
    .leftJoin(employeesTable, eq(attendanceTable.employeeId, employeesTable.id))
    .leftJoin(locationsTable, eq(attendanceTable.locationId as any, locationsTable.id))
    .where(eq(attendanceTable.date, today));

  return res.json({
    date: today,
    records: records.map((r) => ({
      id: r.attendance.id,
      employeeId: r.attendance.employeeId,
      employeeName: r.employee?.name ?? "",
      employeeCode: r.employee?.employeeCode ?? null,
      department: r.employee?.department ?? null,
      locationId: r.attendance.locationId,
      locationName: r.location?.name ?? null,
      date: r.attendance.date,
      checkInTime: r.attendance.checkInTime?.toISOString() ?? null,
      checkOutTime: r.attendance.checkOutTime?.toISOString() ?? null,
      status: r.attendance.status,
      faceVerified: r.attendance.faceVerified,
      locationVerified: r.attendance.locationVerified,
      notes: r.attendance.notes,
      createdAt: r.attendance.createdAt.toISOString(),
    })),
  });
});

// GET /api/dashboard/departments
router.get("/dashboard/departments", requireAuth, async (req, res) => {
  const today = todayDate();

  // Get all employees grouped by department
  const employees = await db.select().from(employeesTable).where(eq(employeesTable.isActive, true));
  const todayRecords = await db.select().from(attendanceTable).where(eq(attendanceTable.date, today));

  const deptMap = new Map<string, { total: number; present: number; late: number; absent: number }>();

  for (const emp of employees) {
    const dept = emp.department || "Unassigned";
    if (!deptMap.has(dept)) {
      deptMap.set(dept, { total: 0, present: 0, late: 0, absent: 0 });
    }
    const d = deptMap.get(dept)!;
    d.total++;

    const record = todayRecords.find((r) => r.employeeId === emp.id);
    if (!record) {
      d.absent++;
    } else if (record.status === "late") {
      d.late++;
    } else {
      d.present++;
    }
  }

  const result = Array.from(deptMap.entries()).map(([department, stats]) => ({
    department,
    ...stats,
    attendanceRate:
      stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0,
  }));

  return res.json(result);
});

// GET /api/dashboard/recent-activity
router.get("/dashboard/recent-activity", requireAuth, async (req, res) => {
  const records = await db
    .select({ attendance: attendanceTable, employee: employeesTable, location: locationsTable })
    .from(attendanceTable)
    .leftJoin(employeesTable, eq(attendanceTable.employeeId, employeesTable.id))
    .leftJoin(locationsTable, eq(attendanceTable.locationId as any, locationsTable.id))
    .orderBy(sql`${attendanceTable.createdAt} DESC`)
    .limit(20);

  const events: any[] = [];
  for (const r of records) {
    if (r.attendance.checkInTime) {
      events.push({
        id: r.attendance.id * 10,
        type: "check-in",
        employeeName: r.employee?.name ?? "",
        employeeCode: r.employee?.employeeCode ?? null,
        department: r.employee?.department ?? null,
        locationName: r.location?.name ?? "Unknown",
        timestamp: r.attendance.checkInTime.toISOString(),
        status: r.attendance.status,
      });
    }
    if (r.attendance.checkOutTime) {
      events.push({
        id: r.attendance.id * 10 + 1,
        type: "check-out",
        employeeName: r.employee?.name ?? "",
        employeeCode: r.employee?.employeeCode ?? null,
        department: r.employee?.department ?? null,
        locationName: r.location?.name ?? "Unknown",
        timestamp: r.attendance.checkOutTime.toISOString(),
        status: r.attendance.status,
      });
    }
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return res.json(events.slice(0, 20));
});

export default router;
