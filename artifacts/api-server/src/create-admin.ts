import bcrypt from "bcryptjs";
import { db, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function createAdmin() {
  const hash = await bcrypt.hash("admin", 12);

  // Check if 'admin' email already exists
  const existing = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.email, "admin"))
    .limit(1);

  if (existing.length > 0) {
    // Update the existing record
    await db
      .update(employeesTable)
      .set({ passwordHash: hash, role: "admin", isActive: true, name: "Admin" })
      .where(eq(employeesTable.email, "admin"));
    console.log("Admin credentials updated.");
  } else {
    await db.insert(employeesTable).values({
      name: "Admin",
      email: "admin",
      passwordHash: hash,
      employeeCode: "ADM-001",
      role: "admin",
      isActive: true,
    });
    console.log("Admin user created.");
  }

  console.log("Login: admin / admin");
  process.exit(0);
}

createAdmin().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
