import nodemailer from "nodemailer";

export async function sendGymApprovalEmail(toEmail, userName) {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 465,
      secure: true, // SSL
      auth: {
        user: process.env.MAIL_USER, // info@fitmuscle.in
        pass: process.env.MAIL_PASS, // hostinger email password
      },
    });

    const htmlTemplate = `
      <div style="font-family: 'Segoe UI', sans-serif; background-color: #f9f9f9; padding: 40px 0;">
        <div style="max-width: 600px; background: #ffffff; margin: auto; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #FF8C32, #FF6B00); padding: 20px; text-align: center;">
            <h1 style="color: #fff; margin: 0;">🎉 Gym Approved!</h1>
          </div>
          <div style="padding: 30px;">
            <h2 style="color: #333;">Hi ${userName},</h2>
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              Congratulations! Your gym has been <strong style="color: #FF6B00;">approved and activated</strong> on our platform.
            </p>

            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              You can now log in to your account, showcase your gym, and start welcoming new members. 🚀
            </p>

            <div style="text-align: center; margin-top: 30px;">
              <a href="https://fitmuscle.in/login" 
                 style="background: #FF8C32; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">
                Go to Dashboard
              </a>
            </div>

            <p style="margin-top: 40px; font-size: 14px; color: #888; text-align: center;">
              If you have any questions, reach out to our support team anytime.<br>
              <a href="mailto:support@fitmuscle.in" style="color: #FF8C32; text-decoration: none;">support@fitmuscle.in</a>
            </p>
          </div>
          <div style="background: #f1f1f1; padding: 10px 20px; text-align: center; font-size: 12px; color: #999;">
            © ${new Date().getFullYear()} FitFinder. All rights reserved.
          </div>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"FitFinder" <${process.env.HOSTINGER_USER}>`,
      to: toEmail,
      subject: "Your Gym Has Been Approved 🎉",
      html: htmlTemplate,
    });

    console.log(`Approval email sent to ${toEmail}`);
  } catch (error) {
    console.error("Error sending approval email:", error);
  }
}







// OTP generator
export function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP email using Hostinger SMTP
export async function sendOtpEmail(toEmail, otp) {
  const transporter = nodemailer.createTransport({
    host: "smtp.hostinger.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.MAIL_USER,   // info@fitmuscle.in
      pass: process.env.MAIL_PASS,   // mailbox password
    },
  });

  const mailOptions = {
    from: `"fit muscle" <${process.env.MAIL_USER}>`,
    to: toEmail,
    subject: "💪 Verify Your fit muscle Account - OTP Code",
    html: `
      <div style="font-family: Arial, sans-serif; background-color:#f4f7fb; padding:20px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" 
              style="max-width:600px; margin:auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.08);">
          
          <tr>
            <td style="padding:25px 30px 10px 30px; text-align:center;">
              <h2 style="margin:0; font-size:22px; color:#111827;">Welcome to <span style="color:#4f46e5;">fit muscle</span>!</h2>
              <p style="font-size:15px; color:#555;">Verify your email to unlock workouts, trainers, and more.</p>
            </td>
          </tr>

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

          <tr>
            <td style="background:#f9fafb; padding:20px; text-align:center; color:#333;">
              <p style="font-size:14px; margin:0;">
                💡 “Discipline is the bridge between goals and results.”
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#111827; text-align:center; padding:15px; font-size:12px; color:#bbb;">
              &copy; ${new Date().getFullYear()} fit muscle App. Stay strong, stay fit 💪
            </td>
          </tr>
        </table>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}
