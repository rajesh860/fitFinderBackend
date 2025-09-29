import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import gymRoutes from "./routes/gymRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import {cronSrevice, markAbsentCron } from "./controller/cronJobs.js"
import "./env.js"; // MongoDB connection
import path from "path";

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

cronSrevice()
markAbsentCron()
// Health check
app.get("/", (req, res) => {
  res.send("Gym Registration API running");
});
const PORT = process.env.PORT || 80;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
