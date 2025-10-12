import express from "express";
import {
  changeUserStatus,
  enquiryCancelled,
  findSignalUser,
  getActiveGymMembers,
  getMembershipHistory,
  getUserAttendence,
  getUserGymEnquiry,
  getUserGymHistory,
  getUserProgressByGym,
  gymApply,
  updateUserProfile,
  userGymEnquiry,
} from "../controller/user.controller.js";
import { uploadMiddleware } from "../middleware/upload.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { buyPlan } from "../controller/plan/plan.js";
// import { markAttendance } from "../controller/userController/index.js";
import { scanGymQR } from "../controller/qrController/index.js";
import { getMemberAttendance } from "../controller/gymController/index.js";
import { addOrUpdateReview } from "../controller/reviewController/index.js";
const router = express.Router();

//gym apply
router.post("/gym-apply/:gymId", authMiddleware, gymApply);

///attendence
// router.post("/attendence-mark", authMiddleware, markAttendance);
router.get("/get-attendence/:gymId", authMiddleware, getUserAttendence);
router.get("/get-progress/:gymId", authMiddleware, getUserProgressByGym);

router.get("/get-gym-history", authMiddleware, getUserGymHistory);
router.get("/get-plan-history", authMiddleware, getMembershipHistory);

router.get("/list", authMiddleware, getActiveGymMembers);

router.get("/profile", authMiddleware, findSignalUser);
router.get("/get-member-attendance/:membershipId/:memberId", authMiddleware, getMemberAttendance);
// router.get("/get-plan-history", authMiddleware, getPlanHistory);

router.put("/:id/status", changeUserStatus);
router.post("/enquiry", authMiddleware, userGymEnquiry);
router.post("/get-enquiry", authMiddleware, getUserGymEnquiry);
router.post("/enquiry-cancelled/:enquiryId", authMiddleware, enquiryCancelled);
router.post("/buy-plan", authMiddleware, buyPlan);
router.post("/mark-attendance", authMiddleware, scanGymQR);
// POST: Add or Update Review
router.post("/add-review", authMiddleware, addOrUpdateReview);
router.put(
  "/update-profile/:id",
  authMiddleware,
  uploadMiddleware(["photo"]),
  updateUserProfile
);

export default router;
