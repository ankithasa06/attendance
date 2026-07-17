import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import employeesRouter from "./employees";
import locationsRouter from "./locations";
import attendanceRouter from "./attendance";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(employeesRouter);
router.use(locationsRouter);
router.use(attendanceRouter);
router.use(dashboardRouter);

export default router;
