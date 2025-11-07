import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import gymRoutes from "./routes/gymRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import trainerRoutes from "./routes/trainerRoutes.js";
import {
  
  // clearMembersWithoutGym,
  // backfillAllMembersAbsentAttendance,
  dailyCronJobs,
  expireTodayMemberships,
  // activateValidMemberships,
} from "./controller/cronJobs.js";
import cron from "node-cron";
import "./env.js"; // MongoDB connection
import path from "path";
import {  generateMonthlyAnalytics } from "./controller/analyticsController/index.js";
import dotenv from "dotenv";

const app = express();

dotenv.config();
app.use(cors());
app.use(bodyParser.json());

// Serve uploaded images
app.use("/uploads", express.static(path.join(path.resolve(), "uploads")));
const router = express.Router();

app.locals.tempOtpStore = {}; // initialize once here
// Routes
app.use("/auth", authRoutes); // Login endpoint here
app.use("/admin", adminRoutes);
app.use("/gym", gymRoutes);
app.use("/user", userRoutes);
app.use("/trainer", trainerRoutes);
// expireTodayMemberships()
// markAbsentMembers()
// clearMembersWithoutGym()
dailyCronJobs();

// Har month ke 1st date 00:00 AM pe run hoga
cron.schedule("0 0 1 * *", async () => {
  console.log("🕒 Running monthly gym analytics cron job...");
  await generateMonthlyAnalytics();
});
app.get("/", (req, res) => {
  res.send("Gym Registration API running");
});
const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});





// 1️⃣ Member side (self-check)

// Request:

// GET /api/membership-history?gymId=64f9b7a1c9a1e2a1b2c3d4f5
// Authorization: Bearer <member_token>

// Admin/Gym side (member-specific)

// Request:

// GET /api/membership-history?gymId=64f9b7a1c9a1e2a1b2c3d4f5&memberId=64f9b6e1c9a1e2a1b2c3d4f0
// Authorization: Bearer <admin_or_gym_token>
