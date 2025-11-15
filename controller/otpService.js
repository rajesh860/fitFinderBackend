import Member from "../models/member.model.js";
import { sendOtpEmail, generateOtp } from "../utils/emailService.js";

// Send OTP to user email
export const sendEmailOtp = async (req, res) => {
  try {
    const { email } = req.body;

    let member = await Member.findOne({ email });
    if (!member)
      return res.status(404).json({ success: false, message: "User not found" });

    const otp = generateOtp();
    const expiry = Date.now() + 5 * 60 * 1000; // 5 mins

    member.email_otp = otp;
    member.otp_expiry = expiry;
    await member.save();

    // Send Email
    await sendOtpEmail(email, otp);

    res.json({ success: true, message: "OTP sent to email successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};


// Verify Email OTP
export const VerifyEmailOtp = async (req, res) => {
  const { email, otp } = req.body;

  const member = await Member.findOne({ email });

  if (!member)
    return res.status(404).json({ success: false, message: "User not found" });

  if (member.otp_expiry < Date.now())
    return res.status(400).json({ success: false, message: "OTP expired" });

  if (member.email_otp !== otp)
    return res.status(400).json({ success: false, message: "Invalid OTP" });

  member.email_verified = true;
  member.email_otp = null;
  member.otp_expiry = null;
  await member.save();

  return res.json({ success: true, message: "Email verified successfully" });
};
