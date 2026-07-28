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

  // Run it immediately on startup!
  runAutoCheckout();
  
  // And then every 10 minutes
  setInterval(runAutoCheckout, 10 * 60 * 1000);
});