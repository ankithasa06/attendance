import { Router } from "express";
import { db } from "@workspace/db";
import { attendanceTable, employeesTable, locationsTable, auditLogsTable } from "@workspace/db";
import { eq, and, gte, lte, SQL, isNull, isNotNull, ne, desc } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any).employeeId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

function mapRecord(
  r: typeof attendanceTable.$inferSelect,
  employee?: typeof employeesTable.$inferSelect | null,
  location?: typeof locationsTable.$inferSelect | null
) {
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeName: employee?.name ?? "",
    employeeCode: employee?.employeeCode ?? null,
    department: employee?.department ?? null,
    locationId: r.locationId,
    locationName: location?.name ?? null,
    attendanceType: r.attendanceType,
    date: r.date,
    checkInTime: r.checkInTime?.toISOString() ?? null,
    checkOutTime: r.checkOutTime?.toISOString() ?? null,
    status: r.status,
    faceVerified: r.faceVerified,
    locationVerified: r.locationVerified,
    notes: r.notes,
    adjustmentHours: r.adjustmentHours,
    checkInLat: r.checkInLat,
    checkInLng: r.checkInLng,
    createdAt: r.createdAt.toISOString(),
  };
}

// GET /api/attendance
router.get("/attendance", requireAuth, async (req, res) => {
  const { employeeId, locationId, date, startDate, endDate, status } = req.query as Record<string, string>;

  const conditions: SQL[] = [];
  if (employeeId) conditions.push(eq(attendanceTable.employeeId, parseInt(employeeId)));
  if (locationId) conditions.push(eq(attendanceTable.locationId as any, parseInt(locationId)));
  if (date) conditions.push(eq(attendanceTable.date, date));
  if (startDate) conditions.push(gte(attendanceTable.date, startDate));
  if (endDate) conditions.push(lte(attendanceTable.date, endDate));
  if (status) conditions.push(eq(attendanceTable.status, status as any));

  const records = await db
    .select({
      attendance: attendanceTable,
      employee: employeesTable,
      location: locationsTable,
    })
    .from(attendanceTable)
    .leftJoin(employeesTable, eq(attendanceTable.employeeId, employeesTable.id))
    .leftJoin(locationsTable, eq(attendanceTable.locationId as any, locationsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return res.json(records.map((r) => mapRecord(r.attendance, r.employee, r.location)));
});

// POST /api/attendance/check-in
router.post("/attendance/check-in", requireAuth, async (req, res) => {
  const { employeeId, locationId, latitude, longitude, faceImageBase64, attendanceType } = req.body as {
    employeeId: number;
    locationId?: number;
    latitude: number;
    longitude: number;
    faceImageBase64?: string;
    attendanceType: "office" | "site";
  };

  if (attendanceType !== "office" && attendanceType !== "site") {
    return res.status(400).json({ error: "Invalid attendanceType. Must be 'office' or 'site'." });
  }

  let location = null;
  
  if (attendanceType === "office") {
    if (!locationId) {
       return res.status(400).json({ error: "Location is required for Office Attendance" });
    }
    // Load location
    const locResult = await db
      .select()
      .from(locationsTable)
      .where(eq(locationsTable.id, locationId))
      .limit(1);
    location = locResult[0];

    if (!location || !location.isActive) {
      return res.status(400).json({ error: "Location not found or inactive" });
    }

    // Geofence check
    const { getDistanceInMeters } = await import("../services/geofence");
    const distance = getDistanceInMeters(latitude, longitude, location.latitude, location.longitude);
    const locationVerified = distance <= location.radius;

    if (!locationVerified) {
      return res.status(400).json({
        error: `You are ${Math.round(distance)}m away from ${location.name}. Must be within ${location.radius}m.`,
      });
    }
  }

  // Face verification
  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, employeeId))
    .limit(1);

  if (!employee) {
    return res.status(400).json({ error: "Employee not found" });
  }

  let faceVerified = false;
  
  if (employee.faceDescriptors && employee.faceDescriptors.length > 0) {
    if (!faceImageBase64) {
      return res.status(400).json({ error: "Face image required for verification" });
    }
    
    // Process image on backend
    const { getFaceDescriptor, findBestMatch } = await import("../services/faceRecognition");
    
    const base64Data = faceImageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");
    const faceDescriptor = await getFaceDescriptor(imageBuffer);
    
    if (!faceDescriptor) {
       return res.status(400).json({ error: "Could not detect a face in the image." });
    }

    faceVerified = findBestMatch(faceDescriptor, employee.faceDescriptors, 0.50);

    if (!faceVerified) {
      console.error("Face verification failed. Descriptor:", faceDescriptor);
      return res.status(400).json({ error: "Face verification failed! You must be verified to check in." });
    }
  }

  // Check for existing record today (using local timezone to match dashboard)
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // Auto-checkout if user forgot to checkout on a previous day
  const [openPrevious] = await db
    .select()
    .from(attendanceTable)
    .where(and(
      eq(attendanceTable.employeeId, employeeId),
      isNotNull(attendanceTable.checkInTime),
      isNull(attendanceTable.checkOutTime),
      ne(attendanceTable.date, today)
    ))
    .orderBy(desc(attendanceTable.date))
    .limit(1);

  if (openPrevious && openPrevious.checkInTime) {
    const autoCheckOutTime = new Date(openPrevious.checkInTime.getTime() + 8 * 60 * 60 * 1000);
    await db
      .update(attendanceTable)
      .set({
        checkOutTime: autoCheckOutTime,
        notes: openPrevious.notes ? `${openPrevious.notes}\nAuto-checkout (forgot to checkout)` : 'Auto-checkout (forgot to checkout)',
        updatedAt: new Date()
      })
      .where(eq(attendanceTable.id, openPrevious.id));
  }

  const [existing] = await db
    .select()
    .from(attendanceTable)
    .where(and(eq(attendanceTable.employeeId, employeeId), eq(attendanceTable.date, today)))
    .limit(1);

  const now = new Date();
  let record;

  if (existing) {
    if (existing.checkInTime) {
      return res.status(400).json({ error: "Already checked in today" });
    }
    // Update existing record
    const [updated] = await db
      .update(attendanceTable)
      .set({
        locationId: attendanceType === "office" ? locationId : null,
        attendanceType,
        checkInTime: now,
        status: "present",
        faceVerified: faceVerified || existing.faceVerified,
        locationVerified: attendanceType === "office",
        checkInLat: latitude,
        checkInLng: longitude,
        updatedAt: new Date()
      })
      .where(eq(attendanceTable.id, existing.id))
      .returning();
    record = updated;
  } else {
    const [inserted] = await db
      .insert(attendanceTable)
      .values({
        employeeId,
        locationId: attendanceType === "office" ? locationId : undefined,
        attendanceType,
        date: today,
        checkInTime: now,
        status: "present",
        faceVerified,
        locationVerified: attendanceType === "office",
        checkInLat: latitude,
        checkInLng: longitude,
      })
      .returning();
    record = inserted;
  }

  // Auto-assign location to employee if they don't have one and checking into an office
  if (attendanceType === "office" && (!employee.locationId || employee.locationId !== locationId)) {
    await db.update(employeesTable)
      .set({ locationId })
      .where(eq(employeesTable.id, employeeId));
  }

  return res.status(201).json(mapRecord(record, employee, location));
});

// POST /api/attendance/check-out
router.post("/attendance/check-out", requireAuth, async (req, res) => {
  const { attendanceId, latitude, longitude, faceImageBase64 } = req.body as {
    attendanceId: number;
    latitude: number;
    longitude: number;
    faceImageBase64?: string;
  };

  const [record] = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.id, attendanceId))
    .limit(1);

  if (!record) return res.status(400).json({ error: "Attendance record not found" });
  if (record.checkOutTime) return res.status(400).json({ error: "Already checked out" });

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, record.employeeId))
    .limit(1);

  // Face verification for check-out
  if (employee.faceDescriptors && employee.faceDescriptors.length > 0) {
    if (!faceImageBase64) {
      return res.status(400).json({ error: "Face image required for check-out verification" });
    }
    
    const { getFaceDescriptor, findBestMatch } = await import("../services/faceRecognition");
    const base64Data = faceImageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");
    const faceDescriptor = await getFaceDescriptor(imageBuffer);
    
    if (!faceDescriptor) {
       return res.status(400).json({ error: "Could not detect a face in the image." });
    }

    const faceVerified = findBestMatch(faceDescriptor, employee.faceDescriptors, 0.50);
    if (!faceVerified) {
      return res.status(400).json({ error: "Face verification failed! You must be verified to check out." });
    }
  }

  const [updated] = await db
    .update(attendanceTable)
    .set({ 
      checkOutTime: new Date(), 
      checkOutLat: latitude,
      checkOutLng: longitude,
      updatedAt: new Date() 
    })
    .where(eq(attendanceTable.id, attendanceId))
    .returning();

  const location = record.locationId
    ? (await db.select().from(locationsTable).where(eq(locationsTable.id, record.locationId)).limit(1))[0]
    : undefined;

  return res.json(mapRecord(updated, employee, location));
});

// GET /api/attendance/:id
router.get("/attendance/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const [result] = await db
    .select({ attendance: attendanceTable, employee: employeesTable, location: locationsTable })
    .from(attendanceTable)
    .leftJoin(employeesTable, eq(attendanceTable.employeeId, employeesTable.id))
    .leftJoin(locationsTable, eq(attendanceTable.locationId as any, locationsTable.id))
    .where(eq(attendanceTable.id, id))
    .limit(1);

  if (!result) return res.status(404).json({ error: "Record not found" });

  return res.json(mapRecord(result.attendance, result.employee, result.location));
});

// PATCH /api/attendance/:id (Admin only)
router.patch("/attendance/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const { status, notes } = req.body;

  const updateData: any = { updatedAt: new Date() };
  if (status !== undefined) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;

  const [updated] = await db
    .update(attendanceTable)
    .set(updateData)
    .where(eq(attendanceTable.id, id))
    .returning();

  if (!updated) return res.status(404).json({ error: "Record not found" });

  const [result] = await db
    .select({ attendance: attendanceTable, employee: employeesTable, location: locationsTable })
    .from(attendanceTable)
    .leftJoin(employeesTable, eq(attendanceTable.employeeId, employeesTable.id))
    .leftJoin(locationsTable, eq(attendanceTable.locationId as any, locationsTable.id))
    .where(eq(attendanceTable.id, id))
    .limit(1);

  return res.json(mapRecord(result.attendance, result.employee, result.location));
});

// POST /api/attendance/override (Admin only)
router.post("/attendance/override", requireAuth, async (req, res) => {
  const { employeeId, date, checkInTime, checkOutTime, travelStartTime, returnTravelStartTime, returnTravelEndTime, locationId, attendanceType, adjustmentHours, reason } = req.body;
  
  if (!employeeId || !date || !reason) {
    return res.status(400).json({ error: "employeeId, date, and reason are required" });
  }

  // Find or create record for that date
  const [existing] = await db
    .select()
    .from(attendanceTable)
    .where(and(eq(attendanceTable.employeeId, employeeId), eq(attendanceTable.date, date)))
    .limit(1);

  const updateData: any = { updatedAt: new Date() };
  if (checkInTime !== undefined) updateData.checkInTime = checkInTime ? new Date(checkInTime) : null;
  if (checkOutTime !== undefined) updateData.checkOutTime = checkOutTime ? new Date(checkOutTime) : null;
  if (travelStartTime !== undefined) updateData.travelStartTime = travelStartTime ? new Date(travelStartTime) : null;
  if (returnTravelStartTime !== undefined) updateData.returnTravelStartTime = returnTravelStartTime ? new Date(returnTravelStartTime) : null;
  if (returnTravelEndTime !== undefined) updateData.returnTravelEndTime = returnTravelEndTime ? new Date(returnTravelEndTime) : null;
  if (locationId !== undefined) updateData.locationId = locationId;
  if (attendanceType !== undefined) updateData.attendanceType = attendanceType;
  
  if (adjustmentHours !== undefined) {
    if (typeof adjustmentHours === 'string') {
      const s = adjustmentHours.toLowerCase().trim();
      let h = 0, m = 0;
      if (s.includes(':')) {
        const parts = s.split(':');
        h = parseInt(parts[0]) || 0;
        m = parseInt(parts[1]) || 0;
      } else if (/^\d+(\.\d+)?$/.test(s)) {
        h = parseFloat(s);
      } else {
        const hMatch = s.match(/(\d+)\s*(h|hr|hrs|hour|hours)/);
        if (hMatch) h = parseInt(hMatch[1]);
        const mMatch = s.match(/(\d+)\s*(m|min|mins|minute|minutes)/);
        if (mMatch) m = parseInt(mMatch[1]);
        if (!hMatch && !mMatch) {
          const nums = s.match(/(\d+)/g);
          if (nums) {
            if (nums.length === 1) h = parseInt(nums[0]);
            else if (nums.length >= 2) { h = parseInt(nums[0]); m = parseInt(nums[1]); }
          }
        }
      }
      updateData.adjustmentHours = h + (m / 60);
    } else {
      updateData.adjustmentHours = parseFloat(adjustmentHours) || 0;
    }
  }

  let record;
  if (existing) {
    // Append reason to notes
    const newNotes = existing.notes ? `${existing.notes}\nOverride: ${reason}` : `Override: ${reason}`;
    updateData.notes = newNotes;
    const [updated] = await db.update(attendanceTable).set(updateData).where(eq(attendanceTable.id, existing.id)).returning();
    record = updated;
  } else {
    updateData.employeeId = employeeId;
    updateData.date = date;
    updateData.notes = `Override: ${reason}`;
    updateData.status = "present";
    const [inserted] = await db.insert(attendanceTable).values(updateData).returning();
    record = inserted;
  }

  // Log in audit_logs
  await db.insert(auditLogsTable).values({
    employeeId,
    eventType: "override",
    metadata: JSON.stringify({ reason, adminId: (req.session as any).employeeId, changes: updateData }),
  });

  return res.json(record);
});

// POST /api/attendance/add-travel-hours (Admin only)
router.post("/attendance/add-travel-hours", requireAuth, async (req, res) => {
  const { employeeId, date, travelHours, reason } = req.body;
  
  if (!employeeId || !date || travelHours === undefined) {
    return res.status(400).json({ error: "employeeId, date, and travelHours are required" });
  }

  const [existing] = await db
    .select()
    .from(attendanceTable)
    .where(and(eq(attendanceTable.employeeId, employeeId), eq(attendanceTable.date, date)))
    .limit(1);

  let record;
  if (existing) {
    const newNotes = existing.notes 
      ? `${existing.notes}\nAdded Travel: ${travelHours} hrs (${reason || 'N/A'})` 
      : `Added Travel: ${travelHours} hrs (${reason || 'N/A'})`;
      
    const [updated] = await db.update(attendanceTable)
      .set({ 
        adjustmentHours: existing.adjustmentHours + parseFloat(travelHours),
        notes: newNotes,
        updatedAt: new Date()
      })
      .where(eq(attendanceTable.id, existing.id)).returning();
    record = updated;
  } else {
    // Create new attendance record just for travel hours if none exists
    const [inserted] = await db.insert(attendanceTable).values({
      employeeId,
      date,
      adjustmentHours: parseFloat(travelHours),
      notes: `Added Travel: ${travelHours} hrs (${reason || 'N/A'})`,
      status: "present"
    }).returning();
    record = inserted;
  }

  await db.insert(auditLogsTable).values({
    employeeId,
    eventType: "override",
    metadata: JSON.stringify({ reason: reason || "Added travel hours", adminId: (req.session as any).employeeId, addedHours: travelHours }),
  });

  return res.json(record);
});

export default router;
