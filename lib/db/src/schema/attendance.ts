import { pgTable, serial, integer, text, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";
import { locationsTable } from "./locations";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employeesTable.id),
  locationId: integer("location_id").references(() => locationsTable.id),
  date: date("date").notNull(),
  checkInTime: timestamp("check_in_time", { withTimezone: true }),
  checkOutTime: timestamp("check_out_time", { withTimezone: true }),
  status: text("status", { enum: ["present", "late", "absent"] })
    .notNull()
    .default("present"),
  faceVerified: boolean("face_verified").notNull().default(false),
  locationVerified: boolean("location_verified").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
