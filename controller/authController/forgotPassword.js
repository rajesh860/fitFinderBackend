import User from "../../models/user.model.js";
import { sendOtpEmail } from "../otpService.js";
import jwt from "jsonwebtoken";

// Helper: Generate random OTP
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// 1️⃣ Send OTP
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    const otp = generateOtp();
const otpExpiry = Date.now() + 5 * 60 * 1000
    // Save OTP temporarily (5 minutes expiry)
    req.app.locals.tempOtpStore[email] = {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
await sendOtpEmail(email, otp);
    // In real app, send via email
    console.log(`📩 OTP for ${email}: ${otp}`);

    return res.json({
      success: true,
      otpExpiry: otpExpiry,
      message: "OTP sent to your email",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};






export const verifyForgotOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const record = req.app.locals.tempOtpStore[email];
console.log(email,otp,record,"verofu otp ")
    if (!record)
      return res.status(400).json({ success: false, message: "No OTP found" });

    if (Date.now() > record.expiresAt)
      return res.status(400).json({ success: false, message: "OTP expired" });

    if (record.otp !== otp)
      return res.status(400).json({ success: false, message: "Invalid OTP" });

    // OTP verified ✅ => create temporary reset token
    const resetToken = jwt.sign({ email }, process.env.SECRET_JWT, {
      expiresIn: "10m",
    });

    // delete otp once used
    delete req.app.locals.tempOtpStore[email];

    return res.json({
      success: true,
      message: "OTP verified successfully",
      resetToken,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};








export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const decoded = jwt.verify(token, process.env.SECRET_JWT);
    const { email } = decoded;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    user.password = newPassword;
    await user.save();

    return res.json({ success: true, message: "Password reset successful" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Invalid or expired token" });
  }
};