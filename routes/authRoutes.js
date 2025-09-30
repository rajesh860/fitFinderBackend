
import express from "express";
import {  requestOtp, verifyOtp} from "../controller/authController/register.js"
import { adminLogin, login } from "../controller/authController/login.js";
const router = express.Router();


router.post("/admin-login", adminLogin);
router.post("/login", login);
router.post("/register", requestOtp);
router.post("/verify-otp", verifyOtp);



export default router;