import express from "express";
import {  getGymDetail, updateGym, gymProfile, getAllGymList } from "../controller/gym.js";
import { createGymPlan, getMyPlans, getPlanName, updateGymPlan} from "../controller/plan/plan.js";
import { uploadMiddleware } from "../middleware/upload.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { addProgressUserByGym, approveEnquiryByAdmin, approveGymBooking, cancelEnquiryByAdmin, completeEnquiryByAdmin, getGymAdminGymEnquiries, getGymBookingRequests, getProgressUserOfGym } from "../controller/user.controller.js";
import {viewuserDetail} from "../controller/gymController/index.js"
const router = express.Router();


router.put(
  "/update-gym-profile/:id",authMiddleware,
  uploadMiddleware([
    { name: "images", maxCount: 10 },
    { name: "coverImage", maxCount: 1 },
     { name: "owner_image", maxCount: 1 }, // Multiple owner images
     { name: "gymCertificates", maxCount: 1 }, // Multiple owner images
  ]),
  updateGym
);

router.get("/user/:id",authMiddleware, viewuserDetail);
router.get("/detail/:id",authMiddleware, getGymDetail);
router.get("/profile",authMiddleware,  gymProfile);
router.post("/get-enquiry/:status",authMiddleware,  getGymAdminGymEnquiries);
router.put("/cancel/enquiry/:id",authMiddleware, cancelEnquiryByAdmin );
router.put("/enquiry/approve/:id",authMiddleware,  approveEnquiryByAdmin);
router.put("/enquiry/complete/:id",authMiddleware, completeEnquiryByAdmin);

////booking
router.post("/booking-request",authMiddleware, getGymBookingRequests);
router.get("/booking-requests",authMiddleware, getGymBookingRequests);
router.post("/booking-approve/:requestId",authMiddleware, approveGymBooking);

///plan
router.post("/create-plans",authMiddleware, createGymPlan);
router.get("/getPlan-name",authMiddleware,getPlanName);
router.get("/getMyPlan/",authMiddleware, getMyPlans);
router.put("/plan-update/:id",authMiddleware, updateGymPlan);


router.post("/add-progress/:memberId",authMiddleware, addProgressUserByGym);
router.get("/get-progress/:memberId",authMiddleware, getProgressUserOfGym);
router.get("/list", getAllGymList);

export default router;
