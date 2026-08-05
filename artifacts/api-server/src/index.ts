import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "Server listening on 0.0.0.0");

  // Pre-warm face recognition models in background so first check-in is instant
  import("./services/faceRecognition").then(({ loadModels }) => {
    loadModels()
      .then(() => logger.info("Face recognition models pre-loaded successfully."))
      .catch((err: any) => logger.error({ err }, "Failed to pre-load face recognition models."));
  });

  // Background Auto-Checkout Task (Runs every 10 minutes)
  const runAutoCheckout = async () => {
    try {
      const { db } = await import("@workspace/db");
      const { attendanceTable } = await import("@workspace/db");
      const { isNull, isNotNull, and, lte, eq } = await import("drizzle-orm");
      
      // Find sessions older than 8 hours
      const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
      
      const orphaned = await db.select().from(attendanceTable).where(
        and(
          isNotNull(attendanceTable.checkInTime),
          isNull(attendanceTable.checkOutTime),
          lte(attendanceTable.checkInTime, eightHoursAgo)
        )
      );
      
      for (const record of orphaned) {
        if (!record.checkInTime) continue;
        const autoCheckOutTime = new Date(record.checkInTime.getTime() + 8 * 60 * 60 * 1000);
        await db.update(attendanceTable)
          .set({
            checkOutTime: autoCheckOutTime,
            notes: record.notes ? `${record.notes}\nAuto-checkout (after 8 hours)` : 'Auto-checkout (after 8 hours)',
            updatedAt: new Date()
          })
          .where(eq(attendanceTable.id, record.id));
        logger.info(`Auto-checked out orphaned session for employee ${record.employeeId}`);
      }
    } catch (err) {
      logger.error({ err }, "Error in auto-checkout cron job");
    }
  };

  // Background Auto-Absent Task (Runs every hour)
  const runAutoAbsent = async () => {
    try {
      const { db } = await import("@workspace/db");
      const { attendanceTable, employeesTable, leaveRequestsTable } = await import("@workspace/db");
      const { eq, and, lte, gte } = await import("drizzle-orm");
      
      const today = new Date();
      // Start from August 1, 2026 (system start date)
      const startDate = new Date("2026-08-01");
      
      // We check up to yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const allActiveEmployees = await db.select().from(employeesTable).where(eq(employeesTable.isActive, true));

      let currDate = new Date(startDate);
      while (currDate <= yesterday) {
        // Skip weekends (0 = Sunday, 6 = Saturday)
        if (currDate.getDay() !== 0 && currDate.getDay() !== 6) {
          const dateStr = `${currDate.getFullYear()}-${String(currDate.getMonth() + 1).padStart(2, "0")}-${String(currDate.getDate()).padStart(2, "0")}`;
          
          for (const emp of allActiveEmployees) {
            // Check if attendance exists
            const [attendance] = await db.select().from(attendanceTable).where(
              and(
                eq(attendanceTable.employeeId, emp.id),
                eq(attendanceTable.date, dateStr)
              )
            ).limit(1);

            if (!attendance) {
              // Check if approved leave exists for this date
              const [leave] = await db.select().from(leaveRequestsTable).where(
                and(
                  eq(leaveRequestsTable.employeeId, emp.id),
                  eq(leaveRequestsTable.status, 'approved'),
                  lte(leaveRequestsTable.startDate, dateStr),
                  gte(leaveRequestsTable.endDate, dateStr)
                )
              ).limit(1);

              if (!leave) {
                // Insert absent record
                await db.insert(attendanceTable).values({
                  employeeId: emp.id,
                  date: dateStr,
                  status: 'absent',
                  attendanceType: 'office',
                  notes: 'Auto-marked absent (No check-in found)'
                });
                logger.info(`Auto-marked absent for employee ${emp.id} on ${dateStr}`);
              }
            }
          }
        }
        currDate.setDate(currDate.getDate() + 1);
      }
    } catch (err) {
      logger.error({ err }, "Error in auto-absent cron job");
    }
  };

  // Run immediately on startup!
  runAutoCheckout();
  runAutoAbsent();
  
  // Schedule intervals
  setInterval(runAutoCheckout, 10 * 60 * 1000); // 10 mins
  setInterval(runAutoAbsent, 60 * 60 * 1000); // 1 hour
});
// force reload test
