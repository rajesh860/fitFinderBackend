import cron from "node-cron";
import nodemailer from "nodemailer";
import dayjs from "dayjs";
import Member from "../models/member.model.js";
import Attendance from "../models/attendence.model.js";

// --- Mail transporter (Gmail / SMTP)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // your Gmail
    pass: process.env.EMAIL_PASS, // app password
  },
});

// -----------------------------
// Membership Expiry Email Cron
// -----------------------------
export const cronService = () => {
  cron.schedule(
    "0 0 * * *", // Every day at 12:00 AM IST
    async () => {
      try {
        console.log("🔔 Running daily membership expiry check...");

        const today = dayjs().startOf("day");
        const upcomingExpiryDate = today.add(3, "day").endOf("day");

        // Find members whose membership expires in next 3 days
        const members = await Member.find({
          membership_end: {
            $lte: upcomingExpiryDate.toDate(),
            $gte: today.toDate(),
          },
        }).populate("user");

        if (!members || members.length === 0) {
          console.log("✅ No memberships expiring soon.");
          return;
        }

        for (const member of members) {
          const email = member.user?.email;
          const name = member.user?.name || "Member";

          if (!email) continue;

          try {
            const mailOptions = {
              from: `"FitMe Gym" <${process.env.EMAIL_USER}>`,
              to: email,
              subject: "⏳ Your Gym Membership is Expiring Soon!",
              text: `Hi ${name},

Your gym membership will expire on ${dayjs(member.membership_end).format(
                "DD MMM YYYY"
              )}. Please renew to continue your fitness journey!

- FitMe Team`,
            };

            await transporter.sendMail(mailOptions);
            console.log(`📩 Reminder email sent to ${email}`);
          } catch (mailErr) {
            console.error(`❌ Failed to send email to ${email}:`, mailErr);
          }
        }
      } catch (error) {
        console.error("❌ Cron Job Error:", error);
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );
};

// -----------------------------
// Daily Absent Marking Cron
// -----------------------------


export const markAbsentCron = () => {
  cron.schedule(
    "59 23 * * *", // Runs daily at 11:59 PM
    async () => {
      console.log("🔔 Running daily absent marking...");

      try {
        const today = dayjs().startOf("day").toDate();

        // 1️⃣ Get all active members only
        const members = await Member.find({ "user.status": "active" })
          .populate("user")
          .populate("currentGym.gym");

        if (!members.length) {
          console.log("⚠️ No active members found.");
          return;
        }

        // 2️⃣ Get all attendance records for today
        const todayAttendances = await Attendance.find({
          date: today,
        }).select("member");

        const attendedMemberIds = new Set(
          todayAttendances.map((a) => a.member.toString())
        );

        // 3️⃣ Filter members who don’t have attendance
        const absentMembers = members.filter(
          (m) => !attendedMemberIds.has(m._id.toString())
        );

        if (!absentMembers.length) {
          console.log("✅ All members marked today. No absentees.");
          return;
        }

        // 4️⃣ Prepare bulk insert
        const absentRecords = absentMembers.map((member) => ({
          insertOne: {
            document: {
              member: member._id,
              gym: member.currentGym?.gym || null,
              date: today,
              status: "absent",
              createdAt: new Date(),
            },
          },
        }));

        // 5️⃣ Bulk insert for performance
        await Attendance.bulkWrite(absentRecords);

        console.log(`✅ Marked ${absentRecords.length} members as absent.`);
      } catch (err) {
        console.error("❌ Error in absent cron job:", err);
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );
};

