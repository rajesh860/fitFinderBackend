import express from "express";
import { changeUserStatus, enquiryCancelled, findSignalUser, getUserAttendence, getUserGymEnquiry, getUserGymHistory, getUsers, gymApply, updateUserProfile, userGymEnquiry } from "../controller/user.controller.js";
import { uploadMiddleware } from "../middleware/upload.js";
import { authMiddleware} from "../middleware/authMiddleware.js"
import { buyPlan } from "../controller/plan/plan.js";
import {markAttendance} from "../controller/userController/index.js"
const router = express.Router();

// User registration
// router.post(
    //   "/register",
    //   // uploadMiddleware(["photo", "id_proof"]), // dono field allowed
    //   UserRegister
    // );

    //gym apply
    router.post("/gym-apply/:gymId", authMiddleware, gymApply);
    
///attendence
router.post("/attendence-mark",authMiddleware, markAttendance);
router.get("/get-attendence/:gymId", authMiddleware,getUserAttendence);
router.get("/get-gym-history", authMiddleware,getUserGymHistory);

router.get("/list",authMiddleware, getUsers);


router.get("/profile", authMiddleware,findSignalUser);
router.put("/:id/status", changeUserStatus);
router.post("/enquiry",authMiddleware, userGymEnquiry);
router.post("/get-enquiry",authMiddleware, getUserGymEnquiry);
router.post("/enquiry-cancelled/:enquiryId",authMiddleware, enquiryCancelled);
router.post("/buy-plan", authMiddleware, buyPlan);
router.put("/update-profile/:id", authMiddleware, uploadMiddleware(["photo"]), updateUserProfile);

export default router;