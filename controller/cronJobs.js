import cron from "node-cron";
import nodemailer from "nodemailer";
import dayjs from "dayjs";
import Member from "../models/member.model.js";
import Attendance from "../models/attendence.model.js";
// Mail transporter (Gmail / SMTP)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // e.g. your@gmail.com
    pass: process.env.EMAIL_PASS, // App password (not normal Gmail password)
  },
});

// 🔔 Cron Job - Runs every day at 12:00 AM (server time)
export  const cronSrevice =()=>{

  cron.schedule(
   "0 0 * * *",
    async () => {
      try {
        console.log("cron start")
        console.log("🔍 Running daily membership expiry check...");
  
       const today = dayjs().startOf("day");
const upcomingExpiryDate = today.add(3, "day").endOf("day");
  
        // Find members expiring in next 3 days
   
        const members = await Member.find({
          membership_end: {
            $lte: upcomingExpiryDate.toDate(),
            $gte: today.toDate(),
          },
        });
        if (!members || members.length === 0) {
          console.log("✅ No memberships expiring soon.");
          return;
        }
  
        for (const user of members) {
          try {
            const mailOptions = {
              from: `"FitMe Gym" <${process.env.EMAIL_USER}>`,
              to: user.email,
              subject: "⏳ Your Gym Membership is Expiring Soon!",
              text: `Hi ${user.first_name} ${user.last_name},
  
  Your membership will expire on ${dayjs(user.membership_end).format(
                "DD MMM YYYY"
              )}. Please renew to continue your fitness journey!
  
  - FitMe Team`,
            };
  
            await transporter.sendMail(mailOptions);
            console.log(`📩 Reminder email sent to ${user.email}`);
          } catch (mailErr) {
            console.error(`❌ Failed to send email to ${user.email}:`, mailErr);
          }
        }
      } catch (error) {
        console.error("❌ Cron Job Error:", error);
      }
    },
    {
      timezone: "Asia/Kolkata", // India time
    }
  );
}






export const markAbsentCron = () => {
  // ✅ Every day at 11:59 PM
  cron.schedule("59 23 * * *", async () => {
    try {
      const today = dayjs().startOf("day").toDate();

      // Get all members
      const members = await Member.find({ status: "active" });

      for (const member of members) {
        const exists = await Attendance.findOne({
          member: member._id,
          date: today,
        });

        if (!exists) {
          // Mark absent
          const absent = new Attendance({
            member: member._id,
            gym: member.gym,
            date: today,
            status: "absent",
          });
          await absent.save();
        }
      }

      console.log("Absent marking cron job completed");
    } catch (err) {
      console.error("Error in absent cron job:", err.message);
    }
  });
};
