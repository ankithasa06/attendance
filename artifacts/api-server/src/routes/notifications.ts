import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any).employeeId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

// Get notifications
router.get("/notifications", requireAuth, async (req, res, next) => {
  try {
    const employeeId = (req.session as any).employeeId;
    
    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.employeeId, employeeId))
      .orderBy(desc(notificationsTable.createdAt));
      
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

// Mark notifications read
router.patch("/notifications", requireAuth, async (req, res, next) => {
  try {
    const employeeId = (req.session as any).employeeId;
    const { ids } = req.body;
    
    if (ids && ids.length > 0) {
      await db.update(notificationsTable)
        .set({ isRead: true })
        .where(inArray(notificationsTable.id, ids));
    }
    
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export const notificationsRouter = router;
