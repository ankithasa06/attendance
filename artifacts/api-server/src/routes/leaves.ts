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
    
    // Entitlement for the year
    const totalThisYearEntitlement = currentYear === 2026 ? 10 : 24;
    
    // Accrued till current month
    let activeMonthsThisYear = currentMonth;
    if (currentYear === 2026) {
      activeMonthsThisYear = currentMonth - 7;
    }
    activeMonthsThisYear = Math.max(0, activeMonthsThisYear);
    const accruedThisYearTillMonth = activeMonthsThisYear * 2;
    
    // Carry forward is 0 as per user request (resets after December)
    const carryForward = 0;
    
    // Calculate taken leaves in the current year
    const currentYearStr = currentYear.toString();
    
    const takenThisYearResult = await db
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
      
    // Calculate taken leaves till date (across all years)
    const takenTillDateResult = await db
      .select({ totalTaken: sql<number>`sum(paid_days)` })
      .from(leaveRequestsTable)
      .where(
        and(
          eq(leaveRequestsTable.employeeId, employeeId),
          eq(leaveRequestsTable.status, 'approved')
        )
      );
      
    const takenThisYear = takenThisYearResult[0]?.totalTaken || 0;
    const totalLop = takenThisYearResult[0]?.totalLop || 0;
    const takenTillDate = takenTillDateResult[0]?.totalTaken || 0;
    
    const remainingLeaves = Math.max(0, carryForward + accruedThisYearTillMonth - takenThisYear);
    
    res.json({ 
      carryForward, 
      totalThisYearEntitlement, 
      accruedThisYearTillMonth, 
      takenThisYear, 
      remainingLeaves, 
      takenTillDate, 
      totalLop 
    });
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
        isCritical: leaveRequestsTable.isCritical,
        createdAt: leaveRequestsTable.createdAt,
        updatedAt: leaveRequestsTable.updatedAt,
      })
      .from(leaveRequestsTable)
      .innerJoin(employeesTable, eq(leaveRequestsTable.employeeId, employeesTable.id));
      
    // Count query for pagination
    let countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(leaveRequestsTable);
      
    if (emp.role !== "admin") {
      query = query.where(eq(leaveRequestsTable.employeeId, employeeId)) as any;
      countQuery = countQuery.where(eq(leaveRequestsTable.employeeId, employeeId)) as any;
    }
    
    // Pagination params
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    
    const countResult = await countQuery;
    const total = countResult[0]?.count || 0;
    
    const leaves = await query.orderBy(desc(leaveRequestsTable.createdAt)).limit(limit).offset(offset);
    res.json({ data: leaves, total });
  } catch (err) {
    next(err);
  }
});

// Create leave request
router.post("/leaves", requireAuth, async (req, res, next) => {
  try {
    const employeeId = (req.session as any).employeeId;
    const { startDate, endDate, reason, leaveType, days, isCritical } = req.body;
    
    const [emp] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, employeeId))
      .limit(1);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Accrued till current month
    let activeMonthsThisYear = currentMonth;
    if (currentYear === 2026) {
      activeMonthsThisYear = currentMonth - 7;
    }
    activeMonthsThisYear = Math.max(0, activeMonthsThisYear);
    const accrued = activeMonthsThisYear * 2;
    
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
    let finalLeaveType: 'paid' | 'loss_of_pay' | 'mixed' | 'emergency' = leaveType as any;
    let finalStatus: 'approved' | 'pending' | 'rejected' | 'cancelled' = isCritical ? 'approved' : 'pending';
    
    if (leaveType === 'paid' || leaveType === 'emergency') {
      if (days > availableBalance) {
        finalPaidDays = availableBalance;
        finalLopDays = days - availableBalance;
        finalLeaveType = availableBalance > 0 ? 'mixed' : 'loss_of_pay';
      } else {
        finalPaidDays = days;
        finalLopDays = 0;
      }
    } else if (leaveType === 'loss_of_pay') {
      finalPaidDays = 0;
      finalLopDays = days;
    }
    
    const [inserted] = await db.insert(leaveRequestsTable).values({
      employeeId,
      startDate,
      endDate,
      reason,
      status: finalStatus,
      leaveType: finalLeaveType,
      isCritical: !!isCritical,
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
