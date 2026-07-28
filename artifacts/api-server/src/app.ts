import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectSqlite3 from "connect-sqlite3";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Trust Replit's reverse proxy so req.secure = true for HTTPS requests
app.set("trust proxy", 1);

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Session middleware
const SQLiteStore = connectSqlite3(session);

app.use(
  session({
    // store: new SQLiteStore({
    //   db: 'sessions.db',
    //   table: 'user_sessions'
    // }),
    secret: process.env.SESSION_SECRET || "fallback-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  })
);

app.get("/", (_req, res) => {
  res.json({
    message: "Welcome to the Attendance Tracker API!",
    docs: "All API routes are prefixed with /api",
    healthCheck: "/api/healthz"
  });
});

app.use("/api", router);

export default app;
