import { db, employeesTable, attendanceTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";

async function clean() {
  console.log("Removing dummy employees and their attendance data...");

  // Delete all attendance records first
  await db.delete(attendanceTable);

  // Delete all employees EXCEPT the admin
  await db.delete(employeesTable).where(ne(employeesTable.role, "admin"));

  console.log("Cleanup complete!");
  process.exit(0);
}

clean().catch((err) => {
  console.error("Failed to clean up:", err);
  process.exit(1);
});
