import express from "express";
import {
  registerTrainer,
  requestOtp,
  resendOtp,
  userRegisterByAdmin,
  
  verifyOtp,
} from "../controller/authController/register.js";
import { adminLogin, demoLogin, login } from "../controller/authController/login.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { forgotPassword, resetPassword, verifyForgotOtp } from "../controller/authController/forgotPassword.js";

const router = express.Router();

router.post("/admin-login", adminLogin);

router.post("/login", login);
router.post("/demo-login", demoLogin);
router.post("/resend-otp", resendOtp);

router.post("/register", requestOtp);
router.post("/trainer-register",authMiddleware, registerTrainer);
router.post("/register-by-admin", authMiddleware, userRegisterByAdmin);

router.post("/verify-otp", verifyOtp);
router.post("/forgot-password", forgotPassword);
router.post("/forgot-password-verify-otp", verifyForgotOtp);
router.post("/reset-password", resetPassword);

export default router;
