import { pgTable, serial, text, boolean, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  employeeCode: varchar("employee_code", { length: 50 }),
  department: text("department"),
  role: text("role", { enum: ["admin", "employee"] }).notNull().default("employee"),
  isActive: boolean("is_active").notNull().default(true),
  // Face descriptors: array of 128-number arrays
  faceDescriptors: jsonb("face_descriptors").$type<number[][]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
