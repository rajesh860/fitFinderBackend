import cron from "node-cron";
import nodemailer from "nodemailer";
import dayjs from "dayjs";
import Member from "../models/member.model.js";
import Attendance from "../models/attendence.model.js";
import User from "../models/user.model.js";
import moment from "moment";
import feesCollectionModel from "../models/feesCollection.model.js";
import MembershipHistory from "../models/planHistroy.model.js";


// --- Mail transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS,
  },
});

// -----------------------------
// 1️⃣ Expire old memberships
// -----------------------------


export const expireTodayMemberships = async () => {
  try {
    console.log("🔄 Checking and expiring memberships whose end date has passed...");

    const endOfToday = moment().endOf("day").toDate();

    // 🔹 Step 1: Find members whose membership_end <= today
    const membersToExpire = await Member.find({
      "currentGym.membership_end": { $lte: endOfToday },
    });

    if (!membersToExpire.length) {
      console.log("✅ No members found with expired membership dates.");
    } else {
      console.log(`⚠️ Found ${membersToExpire.length} members with expired memberships.`);

      // 🔹 Update Members collection
      const memberResult = await Member.updateMany(
        { "currentGym.membership_end": { $lte: endOfToday } },
        {
          $set: {
            "currentGym.status": "expired",
            fee_status: "expired",
          },
        }
      );

      console.log(`✅ Updated ${memberResult.modifiedCount} members as expired.`);
    }

    // 🔹 Step 2: Cross-check FeeCollection also
    const allExpiredMembers = await Member.find({
      "currentGym.status": "expired",
    }).select("_id");

    if (!allExpiredMembers.length) {
      console.log("✅ No expired members found to sync in FeeCollection.");
    } else {
      const memberIds = allExpiredMembers.map((m) => m._id);

      // Update FeeCollection where member is expired but fee is not
      const feeResult = await feesCollectionModel.updateMany(
        {
          member: { $in: memberIds },
          status: { $ne: "expired" },
          planName: { $ne: "BASIC" },
        },
        {
          $set: {
            planName:"BASIC",
            status: "expired",
          },
        }
      );

      console.log(`✅ Updated ${feeResult.modifiedCount} FeeCollection records to expired.`);
    }

    // 🔹 Step 3: Update MembershipHistory (NEW)
    const historyResult = await MembershipHistory.updateMany(
      { membership_end: { $lte: endOfToday }, status: { $ne: "expired" } },
      { $set: { status: "expired" } }
    );

    console.log(`📘 Updated ${historyResult.modifiedCount} MembershipHistory records to expired.`);
    console.log("🎯 Membership, FeeCollection & History fully synced!");
  } catch (error) {
    console.error("❌ Error expiring memberships:", error.message);
  }
};

// export const clearMembersWithoutGym = async () => {
//   try {
//     console.log("🧹 Checking members whose currentGym.gym is missing or null...");

//     // 🔍 Find members jinke currentGym null nahi hai lekin gym missing/null hai
//     const membersToClear = await Member.find({
//       $and: [
//         { currentGym: { $ne: null } },
//         {
//           $or: [
//             { "currentGym.gym": { $exists: false } },
//             { "currentGym.gym": null },
//           ],
//         },
//       ],
//     });

//     if (!membersToClear.length) {
//       console.log("✅ No members found with empty gym in currentGym.");
//       return;
//     }

//     console.log(`⚠️ Found ${membersToClear.length} members to clear.`);

//     // 🧩 Clear each member’s currentGym safely
//     for (const member of membersToClear) {
//       await Member.findByIdAndUpdate(member._id, {
//         $set: { currentGym: null },
//       });
//       console.log(`🧽 Cleared currentGym for member: ${member._id}`);
//     }

//     console.log(`✅ Successfully cleared ${membersToClear.length} members.`);
//   } catch (error) {
//     console.error("❌ Error clearing members without gym:", error.message);
//   }
// };
export const handleMembershipExpiry = async () => {
  try {
    console.log("🔔 Running membership expiry check...");
    await expireTodayMemberships();
  } catch (err) {
    console.error("❌ Error in membership expiry:", err);
  }
};

// -----------------------------
// 2️⃣ Send reminder emails
// -----------------------------
export const sendExpiryEmails = async () => {
  try {
    console.log("🔔 Checking membership expiry reminders...");

    const today = moment().startOf("day");
    const endRange = moment().add(3, "days").endOf("day"); // today + 3 days

    // 🧠 Fetch members whose expiry is between today and next 3 days
    const members = await Member.find({
      $or: [
        {
          membership_end: {
            $gte: today.toDate(),
            $lte: endRange.toDate(),
          },
        },
        {
          "currentGym.membership_end": {
            $gte: today.toDate(),
            $lte: endRange.toDate(),
          },
        },
      ],
    })
      .populate("user")
      .populate("currentGym.plan");

    console.log(`🔍 Found ${members.length} members with upcoming expiry`);

    if (!members.length) {
      console.log("⚠️ No members found with expiring memberships.");
      return;
    }

    for (const member of members) {
      const user = member.user;
      const plan = member.currentGym?.plan;

      // ⚠️ Skip if user ya plan missing
      if (!user || !plan) {
        console.log(`⏭️ Skipping ${user?.email || "unknown"} (missing user/plan)`);
        continue;
      }

      // ✅ Pick correct expiry date
      const expiryDate =
        member.currentGym?.membership_end || member.membership_end;

      if (!expiryDate) {
        console.log(`⏭️ Skipping ${user.email} (no expiry date found)`);
        continue;
      }

      const expiryMoment = moment(expiryDate);
      const daysLeft = expiryMoment.diff(today, "days");

      // 📆 Only email if expiring today, in 2 days, or in 3 days
      if (daysLeft <= 3 && daysLeft >= 0) {
        const email = user.email;
        const name = user.name || "Member";

        try {
          await transporter.sendMail({
            from: `"FitMe Gym" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: "⏳ Your Gym Membership is Expiring Soon!",
            text: `Hi ${name},

Your gym membership for "${plan.name}" will expire on ${expiryMoment.format(
              "DD MMM YYYY"
            )}.
Please renew soon to continue your fitness journey without interruption!

- FitMe Team`,
          });

          console.log(`📩 Reminder email sent to ${email} (expires in ${daysLeft} days)`);
        } catch (mailErr) {
          console.error(`❌ Failed to send email to ${email}:`, mailErr.message);
        }
      } else {
        console.log(
          `⏭️ ${user.email} expires in ${daysLeft} days — skipping for now.`
        );
      }
    }
  } catch (err) {
    console.error("❌ Error in sending reminder emails:", err.message);
  }
};

// -----------------------------
// 3️⃣ Mark absent members
// -----------------------------
export const markAbsentMembers = async () => {
  try {
    // console.log("🔔 Starting absent marking process...");

    // ✅ 1. Get today's start and end time
    const startOfDay = dayjs().startOf("day").toDate();
    const endOfDay = dayjs().endOf("day").toDate();

    // ✅ 1a. Check if today is Sunday (0 = Sunday)
    const todayDay = dayjs().day(); 
    if (todayDay === 0) {
      console.log("🌞 Today is Sunday — marking all active members as present.");

      const activeMembers = await Member.find({
        "currentGym.status": "active",
        "currentGym.gym": { $ne: null },
      }).populate("currentGym.gym");

      if (activeMembers.length) {
        const presentRecords = activeMembers.map((member) => ({
          insertOne: {
            document: {
              member: member._id,
              gym: member.currentGym.gym, // required field
              date: startOfDay, // store only date (start of day)
              status: "present",
              createdAt: new Date(),
            },
          },
        }));

        await Attendance.bulkWrite(presentRecords);
        console.log(`✅ Marked ${presentRecords.length} members as present (Sunday).`);
      }

      return; // skip the rest of the absent logic
    }

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





// import Attendance from "../models/Attendance.js";
// import Member from "../models/Member.js";
// import dayjs from "dayjs";


export const backfillMemberPresentAttendance = async (memberId, gymId) => {
  try {
    if (!memberId || !gymId) {
      throw new Error("MemberId aur GymId dono required hain");
    }

    // ✅ Member fetch
    const member = await Member.findById(memberId).populate("currentGym.gym");
    if (!member) {
      console.log("⚠️ Member nahi mila:", memberId);
      return;
    }

    const startDate = dayjs(member.currentGym.membership_start).startOf("day");
    const endDate = dayjs().endOf("day");

    console.log(`👤 Backfilling attendance for: ${member._id} (${startDate.format("YYYY-MM-DD")} → ${endDate.format("YYYY-MM-DD")})`);

    // ✅ Existing attendance fetch
    const existingAttendances = await Attendance.find({
      member: member._id,
      gym: gymId,
      date: { $gte: startDate.toDate(), $lte: endDate.toDate() },
    }).select("date");

    const existingDates = new Set(
      existingAttendances.map((a) => dayjs(a.date).format("YYYY-MM-DD"))
    );

    const presentRecords = [];

    // ✅ Loop through all days from membership_start → today
    for (
      let d = startDate.clone();
      d.isBefore(endDate) || d.isSame(endDate, "day");
      d = d.add(1, "day")
    ) {
      const dateStr = d.format("YYYY-MM-DD");

      // Agar attendance nahi mili us date ki
      if (!existingDates.has(dateStr)) {
        presentRecords.push({
          insertOne: {
            document: {
              member: member._id,
              gym: gymId,
              date: d.startOf("day").toDate(),
              status: "present",      // ✅ yaha "present"
              createdAt: d.startOf("day").toDate(), // ✅ createdAt bhi wahi date
            },
          },
        });
      }
    }

    // ✅ Bulk insert
    if (presentRecords.length) {
      await Attendance.bulkWrite(presentRecords);
      console.log(`✅ Added ${presentRecords.length} present records for member ${member._id}`);
    } else {
      console.log(`✅ Member ${member._id}: All dates already have attendance.`);
    }
  } catch (err) {
    console.error("❌ Error in backfilling present attendance:", err);
  }
};






// backfillMemberPresentAttendance("68e7dd536cb98dc16555255d","68e1fcdc03e04fa2bc930005") 







export const createMembersFromUsers = async (req, res) => {
  try {
    // ✅ 1. Fetch all active users with role 'member'
    const users = await User.find({ userRole: "member", status: "active" });

    let createdCount = 0;
    const skippedUsers = [];

    for (const user of users) {
      // ✅ Skip if Member already exists
      const existingMember = await Member.findOne({ user: user._id });
      if (existingMember) {
        skippedUsers.push(user._id);
        continue;
      }

      // ✅ Create Member object from User data
      await Member.create({
        user: user._id,
        // Optional: map some default fields
        address: "",
        gender: "None",
        dob: "",
        photo: "",
        currentGym: null,
        gymHistory: [],
        medical_conditions: [],
        injuries: [],
        fitness_goals: [],
        emergency_contacts: [],
        referred_by: "",
        occupation: "",
        notes: "",
      });

      createdCount++;
    }
    console.log("Members created successfully")

    // res.status(200).json({
    //   success: true,
    //   message: `${createdCount} Members created successfully.`,
    //   skipped: skippedUsers,
    // });
  } catch (error) {
    console.error("Error creating members:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// createMembersFromUsers()










// export const assignSequentialUserIds = async (req, res) => {
//   try {
//     console.log("🔄 Resetting all userIds...");
//     // Step 1: Remove old IDs to avoid duplicate constraint
//     await User.updateMany({}, { $unset: { userId: "" } });

//     const users = await User.find().sort({ createdAt: 1 }); // oldest first
//     console.log(`Found ${users.length} users`);

//     let nextId = 100;
//     const bulkOps = users.map((user) => ({
//       updateOne: {
//         filter: { _id: user._id },
//         update: { $set: { userId: String(nextId++) } },
//       },
//     }));

//     if (bulkOps.length > 0) {
//       const result = await User.bulkWrite(bulkOps);
//       console.log(`✅ Updated ${result.modifiedCount} users successfully.`);
//     }

//     // if running as API route
//     if (res) {
//       return res.status(200).json({
//         success: true,
//         message: "User IDs assigned successfully",
//       });
//     } else {
//       console.log("✅ User IDs assigned successfully (script mode).");
//     }

//   } catch (error) {
//     console.error("❌ Error updating userIds:", error);

//     if (res) {
//       return res.status(500).json({ success: false, message: "Server error" });
//     }
//   }
// };


// assignSequentialUserIds()
