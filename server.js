import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import gymRoutes from "./routes/gymRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { 
  // backfillAllMembersAbsentAttendance,
   dailyCronJobs,
  } from "./controller/cronJobs.js"
import cron from "node-cron";
import "./env.js"; // MongoDB connection
import path from "path";
import { generateMonthlyAnalytics } from "./controller/analyticsController/index.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve uploaded images
app.use("/uploads", express.static(path.join(path.resolve(), "uploads")));
const router = express.Router();

app.locals.tempOtpStore = {}; // initialize once here
// Routes
app.use('/auth', authRoutes);    // Login endpoint here
app.use("/admin", adminRoutes);
app.use("/gym", gymRoutes);
app.use("/user", userRoutes);
// markAbsentMembers()
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
