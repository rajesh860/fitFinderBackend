import express from "express";
import {
  getPending,
  approveGym,
  rejectGym,
  getGymList,
  suspendGym,
  getGymDetail,
} from "../controller/gym.js";
import { authorizeRoles } from "../middleware/roleChecker.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { createPlan } from "../controller/plan/plan.js";
const router = express.Router();

// router.post("/register",authMiddleware,, adminRegister);

router.get("/gym-pending", authMiddleware, authorizeRoles("admin"), getPending);
router.put("/:gym_id/approve", authMiddleware, approveGym);
router.get("/gym-detail/:id", authMiddleware, getGymDetail);
router.put("/:gym_id/reject", authMiddleware, rejectGym);
router.put("/:gym_id/suspend", authMiddleware, suspendGym);
router.get("/gym-list", authMiddleware, getGymList);
router.post("/create-plan-name", authMiddleware, createPlan);

export default router;
