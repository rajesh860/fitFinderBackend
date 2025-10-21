import express from "express";

import { authMiddleware } from "../middleware/authMiddleware.js";

import {getAllTrainerList} from "../controller/trainerController/trainerlist.js"
const router = express.Router();



router.get("/list", authMiddleware, getAllTrainerList);



export default router;
