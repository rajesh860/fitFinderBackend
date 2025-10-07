import cron from "node-cron";
import nodemailer from "nodemailer";
import dayjs from "dayjs";
import Member from "../models/member.model.js";
import Attendance from "../models/attendence.model.js";


// --- Mail transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// -----------------------------
// 1️⃣ Expire old memberships
// -----------------------------
export const handleMembershipExpiry = async () => {
  try {
    console.log("🔔 Running membership expiry check...");
    await expireOldMemberships();
  } catch (err) {
    console.error("❌ Error in membership expiry:", err);
  }
};

// -----------------------------
// 2️⃣ Send reminder emails
// -----------------------------
export const sendExpiryEmails = async () => {
  try {
    console.log("🔔 Sending membership expiry reminder emails...");
    const today = dayjs().startOf("day");
    const upcomingExpiryDate = today.add(3, "day").endOf("day");

    const members = await Member.find({
      membership_end: {
        $lte: upcomingExpiryDate.toDate(),
        $gte: today.toDate(),
      },
    }).populate("user");

    for (const member of members) {
      const email = member.user?.email;
      const name = member.user?.name || "Member";
      if (!email) continue;

      try {
        await transporter.sendMail({
          from: `"FitMe Gym" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: "⏳ Your Gym Membership is Expiring Soon!",
          text: `Hi ${name},

Your gym membership will expire on ${dayjs(member.membership_end).format(
            "DD MMM YYYY"
          )}. Please renew to continue your fitness journey!

- FitMe Team`,
        });
        console.log(`📩 Reminder email sent to ${email}`);
      } catch (mailErr) {
        console.error(`❌ Failed to send email to ${email}:`, mailErr);
      }
    }
  } catch (err) {
    console.error("❌ Error in sending reminder emails:", err);
  }
};

// -----------------------------
// 3️⃣ Mark absent members
// -----------------------------
export const markAbsentMembers = async () => {
  try {
    console.log("🔔 Starting absent marking process...");

    // ✅ 1. Get today's start and end time
    const startOfDay = dayjs().startOf("day").toDate();
    const endOfDay = dayjs().endOf("day").toDate();

    // ✅ 2. Get all active members (with active currentGym)
    const activeMembers = await Member.find({
      "currentGym.status": "active",
      "currentGym.gym": { $ne: null },
    })
      .populate("user")
      .populate("currentGym.gym");

    console.log("📋 Total Active Members:", activeMembers.length);

    if (!activeMembers.length) {
      console.log("⚠️ No active members found.");
      return;
    }

    // ✅ 3. Get today's attendance records
    const todayAttendances = await Attendance.find({
      date: { $gte: startOfDay, $lte: endOfDay },
    }).select("member");

    console.log("🟢 Present Members Today:", todayAttendances.length);

    // ✅ 4. Create a set of attended member IDs
    const attendedMemberIds = new Set(
      todayAttendances.map((a) => a.member.toString())
    );

    // ✅ 5. Filter absent members
    const absentMembers = activeMembers.filter(
      (m) => !attendedMemberIds.has(m._id.toString())
    );

    console.log("🔴 Absent Members Found:", absentMembers.length);

    // ✅ 6. Prepare absent records
    if (absentMembers.length) {
      const absentRecords = absentMembers.map((member) => ({
        insertOne: {
          document: {
            member: member._id,
            gym: member.currentGym.gym, // required field
            date: startOfDay, // store only date (start of day)
            status: "absent",
            createdAt: new Date(),
          },
        },
      }));

      // ✅ 7. Bulk insert all absent records
      await Attendance.bulkWrite(absentRecords);
      console.log(`✅ Marked ${absentRecords.length} members as absent.`);
    } else {
      console.log("✅ All active members have attendance today.");
    }
  } catch (err) {
    console.error("❌ Error in marking absent members:", err);
  }
};

// -----------------------------
// Cron job
// -----------------------------
export const dailyCronJobs = () => {
  cron.schedule(
    "0 0 * * *", // Every day at 12:00 AM IST
    async () => {
      console.log("🔔 Running all daily cron jobs...");

      await markAbsentMembers();
      await handleMembershipExpiry();
      await sendExpiryEmails();

      console.log("✅ All daily cron jobs completed.");
    },
    {
      timezone: "Asia/Kolkata",
    }
  );
};

// Start cron





// export const backfillAllMembersAbsentAttendance = async () => {
//   try {
//     console.log("🔁 Starting backfill for all active members...");

//     // 1. Get all active members with valid gym
//     const activeMembers = await Member.find({
//       "currentGym.status": "active",
//       "currentGym.gym": { $ne: null },
//     }).populate("currentGym.gym");

//     console.log(`📋 Total Active Members: ${activeMembers.length}`);

//     if (!activeMembers.length) {
//       console.log("⚠️ No active members found. Exiting.");
//       return;
//     }

//     let totalAbsentRecords = 0;

//     // 2. Loop through each active member
//     for (const member of activeMembers) {
//       const startDate = dayjs(member.currentGym.membership_start).startOf("day");
//       const endDate = dayjs().endOf("day");

//       console.log(`👤 Checking: ${member._id} (${startDate.format("YYYY-MM-DD")} → ${endDate.format("YYYY-MM-DD")})`);

//       // 3. Get all existing attendance records for this member
//       const existingAttendances = await Attendance.find({
//         member: member._id,
//         date: { $gte: startDate.toDate(), $lte: endDate.toDate() },
//       }).select("date");

//       const existingDates = new Set(
//         existingAttendances.map((a) => dayjs(a.date).format("YYYY-MM-DD"))
//       );

//       const absentRecords = [];

//       // 4. Loop through each day from membership_start → today
//       for (
//         let d = startDate.clone();
//         d.isBefore(endDate) || d.isSame(endDate, "day");
//         d = d.add(1, "day")
//       ) {
//         const dateStr = d.format("YYYY-MM-DD");

//         // Agar attendance nahi mili us date ki
//         if (!existingDates.has(dateStr)) {
//           absentRecords.push({
//             insertOne: {
//               document: {
//                 member: member._id,
//                 gym: member.currentGym.gym,
//                 date: d.startOf("day").toDate(),
//                 status: "absent",
//                 createdAt: new Date(),
//               },
//             },
//           });
//         }
//       }

//       // 5. Insert missing absent records
//       if (absentRecords.length) {
//         await Attendance.bulkWrite(absentRecords);
//         console.log(`✅ Member ${member._id}: Added ${absentRecords.length} missing absent records.`);
//         totalAbsentRecords += absentRecords.length;
//       } else {
//         console.log(`✅ Member ${member._id}: All dates have attendance.`);
//       }
//     }

//     console.log(`🎉 Backfill completed. Total ${totalAbsentRecords} absent records added.`);
//   } catch (err) {
//     console.error("❌ Error in backfilling attendance:", err);
//   }
// };