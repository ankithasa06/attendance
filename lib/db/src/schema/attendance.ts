import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";
import { locationsTable } from "./locations";

export const attendanceTable = sqliteTable("attendance", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employeesTable.id),
  locationId: integer("location_id").references(() => locationsTable.id),
  attendanceType: text("attendance_type", { enum: ["office", "site"] }).notNull().default("office"),
  date: text("date").notNull(),
  checkInTime: integer("check_in_time", { mode: "timestamp" }),
  checkOutTime: integer("check_out_time", { mode: "timestamp" }),
  status: text("status", { enum: ["present", "late", "absent"] })
    .notNull()
    .default("present"),
  travelStartTime: integer("travel_start_time", { mode: "timestamp" }),
  returnTravelStartTime: integer("return_travel_start_time", { mode: "timestamp" }),
  returnTravelEndTime: integer("return_travel_end_time", { mode: "timestamp" }),
  adjustmentHours: integer("adjustment_hours", { mode: "number" }).notNull().default(0),
  faceVerified: integer("face_verified", { mode: "boolean" }).notNull().default(false),
  locationVerified: integer("location_verified", { mode: "boolean" }).notNull().default(false),
  distanceCovered: integer("distance_covered").notNull().default(0),
  checkInLat: real("check_in_lat"),
  checkInLng: real("check_in_lng"),
  checkOutLat: real("check_out_lat"),
  checkOutLng: real("check_out_lng"),
  syncStatus: text("sync_status", { enum: ["synced", "pending"] }).notNull().default("synced"),
  sessionType: text("session_type").notNull().default("regular"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
