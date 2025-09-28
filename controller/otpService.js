import nodemailer from "nodemailer";
import Member from "../models/member.model.js";
// OTP generator
export function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP email
export async function sendOtpEmail(toEmail, otp) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASS,
    },
  });

const mailOptions = {
  from: `"fitMe App" <${process.env.GMAIL_USER}>`,
  to: toEmail,
  subject: "💪 Verify Your fitMe Account - OTP Code",
  html: `
  <div style="font-family: Arial, sans-serif; background-color:#f4f7fb; padding:20px;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" 
           style="max-width:600px; margin:auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.08);">
      
    
      
      <!-- Title -->
      <tr>
        <td style="padding:25px 30px 10px 30px; text-align:center;">
          <h2 style="margin:0; font-size:22px; color:#111827;">Welcome to <span style="color:#4f46e5;">fitMe</span>!</h2>
          <p style="font-size:15px; color:#555;">Verify your email to unlock workouts, trainers, and more.</p>
        </td>
      </tr>

      <!-- OTP Box -->
      <tr>
        <td style="padding:20px 30px; text-align:center;">
          <div style="margin:20px auto; display:inline-block; background:#4f46e5; color:#fff; 
                      font-size:28px; letter-spacing:6px; padding:18px 40px; 
                      border-radius:10px; font-weight:bold;">
            ${otp}
          </div>
          <p style="font-size:14px; color:#666; margin-top:15px;">
            This OTP is valid for <b>5 minutes</b>. Please don’t share it with anyone.
          </p>
        </td>
      </tr>

      <!-- Motivation / Gym Vibe -->
      <tr>
        <td style="background:#f9fafb; padding:20px; text-align:center; color:#333;">
          <p style="font-size:14px; margin:0;">
            💡 “Discipline is the bridge between goals and results.”
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#111827; text-align:center; padding:15px; font-size:12px; color:#bbb;">
          &copy; ${new Date().getFullYear()} fitMe App. Stay strong, stay fit 💪
        </td>
      </tr>
    </table>
  </div>
  `,
};



  await transporter.sendMail(mailOptions);
}




export const VerifyEmailOtp = async (req, res) => {
  const { email, otp } = req.body;
  const member = await Member.findOne({ email });

  if (!member) return res.status(404).json({ success: false, message: "User not found" });
  if (member.otp_expiry < Date.now()) return res.status(400).json({ success: false, message: "OTP expired" });
  if (member.email_otp !== otp) return res.status(400).json({ success: false, message: "Invalid OTP" });

  member.email_verified = true;
  member.email_otp = null;
  member.otp_expiry = null;
  await member.save();

  return res.json({ success: true, message: "Email verified successfully" });
};
