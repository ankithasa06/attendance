import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { locationsTable } from "./locations";

export const employeesTable = sqliteTable("employees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  employeeCode: text("employee_code"),
  department: text("department"),
  role: text("role", { enum: ["admin", "employee"] }).notNull().default("employee"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  locationId: integer("location_id").references(() => locationsTable.id),
  // Face descriptors: array of 128-number arrays
  faceDescriptors: text("face_descriptors", { mode: "json" }).$type<number[][]>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
