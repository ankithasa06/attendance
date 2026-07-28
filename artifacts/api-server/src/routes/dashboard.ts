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
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
      attendanceType: r.attendance.attendanceType,
      date: r.attendance.date,
      checkInTime: r.attendance.checkInTime?.toISOString() ?? null,
      checkOutTime: r.attendance.checkOutTime?.toISOString() ?? null,
      travelStartTime: r.attendance.travelStartTime?.toISOString() ?? null,
      returnTravelStartTime: r.attendance.returnTravelStartTime?.toISOString() ?? null,
      returnTravelEndTime: r.attendance.returnTravelEndTime?.toISOString() ?? null,
      adjustmentHours: r.attendance.adjustmentHours,
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

// GET /api/dashboard/employee
router.get("/dashboard/employee", requireAuth, async (req, res) => {
  let employeeId = (req.session as any).employeeId;

  // Allow admin to specify a different employee ID
  if (req.query.employeeId) {
    const [user] = await db.select().from(employeesTable).where(eq(employeesTable.id, employeeId)).limit(1);
    if (user && user.role === 'admin') {
      employeeId = parseInt(req.query.employeeId as string);
    }
  }

  const now = new Date();
  
  // Calculate start of week (Monday)
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);

  const { gte } = await import("drizzle-orm");

  const records = await db
    .select()
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.employeeId, employeeId),
        gte(attendanceTable.date, startOfWeek.toISOString().split("T")[0])
      )
    );

  let weeklyHours = 0;
  let todayHours = 0;
  const todayStr = new Date().toISOString().split("T")[0];
  let todayRecord = null;

  for (const r of records) {
    // Exclude Sundays (0)
    if (new Date(r.date).getDay() === 0) continue;

    let hours = 0;
    const nowMs = new Date().getTime();

    // 1. Site work time
    if (r.checkInTime) {
      const checkOut = r.checkOutTime ? new Date(r.checkOutTime).getTime() : nowMs;
      const checkIn = new Date(r.checkInTime).getTime();
      hours += (checkOut - checkIn) / (1000 * 60 * 60);
    }

    // 2. Initial Travel time
    if (r.travelStartTime) {
      const endInitialTravel = r.checkInTime ? new Date(r.checkInTime).getTime() : nowMs;
      const startInitialTravel = new Date(r.travelStartTime).getTime();
      hours += (endInitialTravel - startInitialTravel) / (1000 * 60 * 60);
    }

    // 3. Return Travel time
    if (r.returnTravelStartTime) {
      const endReturnTravel = r.returnTravelEndTime ? new Date(r.returnTravelEndTime).getTime() : nowMs;
      const startReturnTravel = new Date(r.returnTravelStartTime).getTime();
      hours += (endReturnTravel - startReturnTravel) / (1000 * 60 * 60);
    }

    // 4. Admin Adjustments
    if (r.adjustmentHours) {
      hours += Number(r.adjustmentHours);
    }

    weeklyHours += hours;

    if (r.date === todayStr) {
      todayHours = hours;
      todayRecord = r;
    }
  }

  return res.json({
    weeklyHours,
    dailyHours: todayHours,
    todayRecord: todayRecord ? {
      id: todayRecord.id,
      travelStartTime: todayRecord.travelStartTime?.toISOString(),
      checkInTime: todayRecord.checkInTime?.toISOString(),
      checkOutTime: todayRecord.checkOutTime?.toISOString(),
      returnTravelStartTime: todayRecord.returnTravelStartTime?.toISOString(),
      returnTravelEndTime: todayRecord.returnTravelEndTime?.toISOString(),
      adjustmentHours: todayRecord.adjustmentHours,
      status: todayRecord.status
    } : null
  });
});

export default router;
