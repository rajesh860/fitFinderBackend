import express from "express";

import { authMiddleware } from "../middleware/authMiddleware.js";

import {getAllTrainerList, getTrainerProfile} from "../controller/trainerController/trainerlist.js"
import { getTrainerDetail, updateProfile} from "../controller/trainerController/profileUpdate.js"
import { uploadMiddleware } from "../middleware/upload.js";
const router = express.Router();



router.get("/list", authMiddleware, getAllTrainerList);
router.post("/update-profile/:trainerId",authMiddleware, uploadMiddleware([{ name: "photo", maxCount: 1 }]), updateProfile);
router.get("/profile", authMiddleware,getTrainerProfile);
router.get("/detail/:id", authMiddleware,getTrainerDetail);



export default router;
