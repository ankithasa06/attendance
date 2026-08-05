import { Router } from "express";
import { db } from "@workspace/db";
import { leaveRequestsTable, employeesTable, notificationsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any).employeeId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

function requireAdmin(req: any, res: any, next: any) {
  (async () => {
    const employeeId = (req.session as any).employeeId;
    if (!employeeId) return res.status(401).json({ error: "Not authenticated" });

    const [emp] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, employeeId))
      .limit(1);

    if (!emp || emp.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  })().catch(next);
}

// Get leave summary
router.get("/leaves/summary", requireAuth, async (req, res, next) => {
  try {
    const employeeId = (req.session as any).employeeId;
    
    const [emp] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, employeeId))
      .limit(1);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // System launched in August 2026
    let activeMonths = currentMonth;
    if (currentYear === 2026) {
      activeMonths = currentMonth - 7; // August is month 1
    }
    activeMonths = Math.max(0, activeMonths);
    
    const accrued = activeMonths * 2;
    
    // Calculate taken leaves in the current year
    const currentYearStr = currentYear.toString();
    
    const takenResult = await db
      .select({ 
        totalTaken: sql<number>`sum(paid_days)`,
        totalLop: sql<number>`sum(lop_days)`
      })
      .from(leaveRequestsTable)
      .where(
        and(
          eq(leaveRequestsTable.employeeId, employeeId),
          eq(leaveRequestsTable.status, 'approved'),
          sql`strftime('%Y', start_date) = ${currentYearStr}`
        )
      );
      
    const taken = takenResult[0]?.totalTaken || 0;
    const totalLop = takenResult[0]?.totalLop || 0;
    const balance = Math.max(0, accrued - taken);
    
    res.json({ accrued, taken, balance, totalLop });
  } catch (err) {
    next(err);
  }
});

// List leaves
router.get("/leaves", requireAuth, async (req, res, next) => {
  try {
    const employeeId = (req.session as any).employeeId;
    
    // Admin check for viewing all
    const [emp] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, employeeId))
      .limit(1);
      
    let query = db
      .select({
        id: leaveRequestsTable.id,
        employeeId: leaveRequestsTable.employeeId,
        employeeName: employeesTable.name,
        startDate: leaveRequestsTable.startDate,
        endDate: leaveRequestsTable.endDate,
        reason: leaveRequestsTable.reason,
        status: leaveRequestsTable.status,
        leaveType: leaveRequestsTable.leaveType,
        days: leaveRequestsTable.days,
        paidDays: leaveRequestsTable.paidDays,
        lopDays: leaveRequestsTable.lopDays,
        adminNotes: leaveRequestsTable.adminNotes,
        createdAt: leaveRequestsTable.createdAt,
        updatedAt: leaveRequestsTable.updatedAt,
      })
      .from(leaveRequestsTable)
      .innerJoin(employeesTable, eq(leaveRequestsTable.employeeId, employeesTable.id));
      
    if (emp.role !== "admin") {
      query = query.where(eq(leaveRequestsTable.employeeId, employeeId)) as any;
    }
    
    const leaves = await query.orderBy(desc(leaveRequestsTable.createdAt));
    res.json(leaves);
  } catch (err) {
    next(err);
  }
});

// Create leave request
router.post("/leaves", requireAuth, async (req, res, next) => {
  try {
    const employeeId = (req.session as any).employeeId;
    const { startDate, endDate, reason, leaveType, days } = req.body;
    
    const [emp] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, employeeId))
      .limit(1);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // System launched in August 2026
    let activeMonths = currentMonth;
    if (currentYear === 2026) {
      activeMonths = currentMonth - 7; // August is month 1
    }
    activeMonths = Math.max(0, activeMonths);
    
    const accrued = activeMonths * 2;
    const currentYearStr = currentYear.toString();
    
    const takenResult = await db.select({ totalTaken: sql<number>`sum(paid_days)` })
      .from(leaveRequestsTable)
      .where(
        and(
          eq(leaveRequestsTable.employeeId, employeeId),
          eq(leaveRequestsTable.status, 'approved'),
          sql`strftime('%Y', start_date) = ${currentYearStr}`
        )
      );
      
    const totalTaken = takenResult[0]?.totalTaken || 0;
    const availableBalance = Math.max(0, accrued - totalTaken);
    
    let finalPaidDays = days;
    let finalLopDays = 0;
    let finalLeaveType = leaveType;
    
    if (leaveType === 'paid' && days > availableBalance) {
      return res.status(400).json({ error: "Only earned paid leaves can be used. Please adjust your dates or request a Loss of Pay leave." });
    } else if (leaveType === 'loss_of_pay') {
      finalPaidDays = 0;
      finalLopDays = days;
    }
    
    const [inserted] = await db.insert(leaveRequestsTable).values({
      employeeId,
      startDate,
      endDate,
      reason,
      leaveType: finalLeaveType,
      days,
      paidDays: finalPaidDays,
      lopDays: finalLopDays
    }).returning();
    
    // Notify admins
    const admins = await db.select().from(employeesTable).where(eq(employeesTable.role, 'admin'));
    const message = `${emp.name} has requested a ${days}-day leave starting from ${startDate}.`;
    
    if (admins.length > 0) {
      await db.insert(notificationsTable).values(
        admins.map(a => ({
          employeeId: a.id,
          leaveRequestId: inserted.id,
          message,
        }))
      );
    }
    
    return res.status(201).json({ ...inserted, employeeName: emp.name });
  } catch (err) {
    return next(err);
  }
});

// Update leave status (Admin only)
router.patch("/leaves/:id/status", requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { status, adminNotes } = req.body;
    
    if (status === 'rejected' && !adminNotes) {
      return res.status(400).json({ error: "A reason is required when rejecting a leave." });
    }
    
    const [updated] = await db.update(leaveRequestsTable)
      .set({ status, adminNotes, updatedAt: new Date() })
      .where(eq(leaveRequestsTable.id, id))
      .returning();
      
    if (!updated) {
      return res.status(404).json({ error: "Leave request not found" });
    }
    
    // Create notification for employee
    let message = `Your leave request for ${updated.startDate} has been ${status}.`;
    if (status === 'rejected' && adminNotes) {
      message += ` Reason: ${adminNotes}`;
    }
    await db.insert(notificationsTable).values({
      employeeId: updated.employeeId,
      leaveRequestId: updated.id,
      message,
    });
    
    const [emp] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, updated.employeeId))
      .limit(1);
      
    return res.json({ ...updated, employeeName: emp.name });
  } catch (err) {
    return next(err);
  }
});

export const leavesRouter = router;
