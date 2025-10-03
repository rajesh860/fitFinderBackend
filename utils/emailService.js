import nodemailer from "nodemailer";
export async function sendGymApprovalEmail(toEmail, userName) {
  try {
    console;
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASS,
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
              <a href="http://13.60.166.240/login" 
                 style="background: #FF8C32; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">
                Go to Dashboard
              </a>
            </div>

            <p style="margin-top: 40px; font-size: 14px; color: #888; text-align: center;">
              If you have any questions, reach out to our support team anytime.<br>
              <a href="mailto:support@yourappdomain.com" style="color: #FF8C32; text-decoration: none;">support@yourappdomain.com</a>
            </p>
          </div>
          <div style="background: #f1f1f1; padding: 10px 20px; text-align: center; font-size: 12px; color: #999;">
            © ${new Date().getFullYear()} FitFinder. All rights reserved.
          </div>
        </div>
      </div>
    `;

    await transporter.sendMail({
      headers: {
        "List-Unsubscribe":
          "<mailto:support@fitfinder.com>, <https://yourappdomain.com/unsubscribe>",
      },
      from: `"FitFinder" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: "Your Gym Has Been Approved 🎉",
      html: htmlTemplate,
    });

    console.log(`Approval email sent to ${toEmail}`);
  } catch (error) {
    console.error("Error sending approval email:", error);
  }
}
