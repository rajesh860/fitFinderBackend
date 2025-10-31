import express from "express";

import { authMiddleware } from "../middleware/authMiddleware.js";

import {getAllTrainerList, getTrainerProfile} from "../controller/trainerController/trainerlist.js"
import { getTrainerDetail, updateProfile} from "../controller/trainerController/profileUpdate.js"
import { uploadMiddleware } from "../middleware/upload.js";
import {addTrainerReview, bookTrainer, createTrainerPlan, getTrainerAvailableSlots, getTrainerReviews} from "../controller/trainerController/reviewController.js"
const router = express.Router();



router.get("/list", authMiddleware, getAllTrainerList);
router.post("/update-profile/:trainerId",authMiddleware, uploadMiddleware([{ name: "photo", maxCount: 1 }]), updateProfile);
router.get("/profile", authMiddleware,getTrainerProfile);
router.get("/detail/:id", authMiddleware,getTrainerDetail);
router.post("/add-review/:trainerId", authMiddleware,addTrainerReview);
router.get("/get-review/:trainerId", authMiddleware,getTrainerReviews);
router.get("/hire", authMiddleware,bookTrainer);
router.get("/available-slots/:trainerId", authMiddleware,getTrainerAvailableSlots);
router.get("/plan-create/", authMiddleware,createTrainerPlan);



export default router;
