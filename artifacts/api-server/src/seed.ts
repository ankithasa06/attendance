import bcrypt from "bcryptjs";
import { db, employeesTable, locationsTable, attendanceTable } from "@workspace/db";

async function seed() {
  console.log("Seeding database...");

  // Create admin user
  const adminHash = await bcrypt.hash("admin123", 12);
  const empHash = await bcrypt.hash("employee123", 12);

  const [admin] = await db
    .insert(employeesTable)
    .values({
      name: "Admin User",
      email: "admin@company.com",
      passwordHash: adminHash,
      employeeCode: "ADM001",
      department: "Management",
      role: "admin",
      isActive: true,
    })
    .onConflictDoNothing()
    .returning();

  const employees = await db
    .insert(employeesTable)
    .values([
      {
        name: "Priya Sharma",
        email: "priya.sharma@company.com",
        passwordHash: empHash,
        employeeCode: "EMP001",
        department: "Engineering",
        role: "employee",
        isActive: true,
      },
      {
        name: "Rahul Mehta",
        email: "rahul.mehta@company.com",
        passwordHash: empHash,
        employeeCode: "EMP002",
        department: "Engineering",
        role: "employee",
        isActive: true,
      },
    ])
    .onConflictDoNothing()
    .returning();

  console.log("Employees seeded:", employees.length);

  // Create locations
  const locations = await db
    .insert(locationsTable)
    .values([


    ])
    .onConflictDoNothing()
    .returning();

  console.log("Locations seeded:", locations.length);

  // Create attendance records for the past few days
  const allEmployees = await db.select().from(employeesTable);
  const allLocations = await db.select().from(locationsTable);

  if (allEmployees.length > 0 && allLocations.length > 0) {
    const today = new Date();
    const dates = [-2, -1, 0].map((offset) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      return d.toISOString().split("T")[0];
    });

    for (const dateStr of dates) {
      for (let i = 0; i < allEmployees.length; i++) {
        const emp = allEmployees[i];
        const loc = allLocations[i % allLocations.length];
        const skip = Math.random() < 0.15; // 15% absent
        if (skip) continue;

        const isLate = Math.random() < 0.2; // 20% late
        const checkInHour = isLate ? 10 : 9;
        const checkInMin = Math.floor(Math.random() * 30);

        const checkInHourStr = checkInHour.toString().padStart(2, "0");
        const checkIn = new Date(`${dateStr}T${checkInHourStr}:${checkInMin.toString().padStart(2, "0")}:00.000Z`);
        const checkOut = new Date(checkIn.getTime() + 8 * 3600 * 1000 + Math.random() * 3600 * 1000);

        await db
          .insert(attendanceTable)
          .values({
            employeeId: emp.id,
            locationId: loc.id,
            date: dateStr,
            checkInTime: checkIn,
            checkOutTime: dateStr < today.toISOString().split("T")[0] ? checkOut : null,
            status: isLate ? "late" : "present",
            faceVerified: true,
            locationVerified: true,
          })
          .onConflictDoNothing();
      }
    }
    console.log("Attendance records seeded");
  }

  console.log("Seed complete!");
  console.log("Admin login: admin@company.com / admin123");
  console.log("Employee login: priya.sharma@company.com / employee123");
  process.exit(0);
}

seed().catch((e) => {
  console.error("Seed error:", e);
  process.exit(1);
});
