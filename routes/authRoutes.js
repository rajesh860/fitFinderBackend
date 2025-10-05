import express from "express";
import {
  requestOtp,
  userRegistorByAdmin,
  verifyOtp,
} from "../controller/authController/register.js";
import { adminLogin, login } from "../controller/authController/login.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/admin-login", adminLogin);

router.post("/login", login);

router.post("/register", requestOtp);
router.post("/register-by-admin", authMiddleware, userRegistorByAdmin);

router.post("/verify-otp", verifyOtp);

export default router;
