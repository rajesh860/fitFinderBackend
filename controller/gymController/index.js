import Member from "../../models/member.model.js";
import Attendance from "../../models/attendence.model.js";
import Progress from "../../models/progess.model.js";
import { GymPlan } from "../../models/planSchema.js";
import Gym from "../../models/gym.model.js";

export const viewuserDetail = async (req, res) => {
  try {
    const { id } = req.params;

    // Populate user, currentGym.plan and currentGym.gym
    const doc = await Member.findById(id)
      .populate("user", "name email phone userRole status createdAt updatedAt")
      .populate("currentGym.plan", "name planPrice duration")
      .populate("currentGym.gym", "gymName location address phone") // add fields you want from Gym
      .lean();

    if (!doc) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    // Fetch GymPlan details if currentGym exists
    let gymPlanData = null;

    const getAttendance = await Attendance.find({
      member: id,
      gym: doc?.currentGym?.gym?._id,
    });
    // ✅ If currentGym exists, find price & duration from GymPlan
    if (doc.currentGym?.gym?._id && doc.currentGym?.plan?._id) {
      gymPlanData = await GymPlan.findOne({
        gymId: doc.currentGym.gym._id,
        planId: doc.currentGym.plan._id,
      }).select("price durationInMonths");
    }
    // Build flattened response
    const flattened = {
      id: doc._id,
      // Top-level user fields (flattened)

      // id: doc.user?._id || null,
      name: doc.user?.name || null,
      email: doc.user?.email || null,
      phone: doc.user?.phone || null,
      role: doc.user?.userRole || null,
      status: doc.user?.status || null,
      createdAt: doc.user?.createdAt || null,
      updatedAt: doc.user?.updatedAt || null,

      // Member-specific fields
      address: doc.address || null,
      gender: doc.gender || null,
      dob: doc.dob || null,
      photo: doc.photo ? `${process.env.DOMAIN}/${doc.photo}` : null,
      fee_status: doc.fee_status || null,
      blood_group: doc.blood_group || null,
      medical_conditions: doc.medical_conditions || [],
      injuries: doc.injuries || [],
      fitness_goals: doc.fitness_goals || [],
      emergency_contacts: doc.emergency_contacts || [],
      referred_by: doc.referred_by || null,
      occupation: doc.occupation || null,
      notes: doc.notes || null,
      registered_at: doc.createdAt || null,
      updated_at: doc.updatedAt || null,

      // Current membership (flattened)
      currentMembership: doc.currentGym
        ? {
            attendance: getAttendance,
            gymId: doc.currentGym.gym?._id || null,
            gymName: doc.currentGym.gym?.gymName || (doc.gym ? doc.gym : null),
            gymLocation: doc.currentGym.gym?.location || null,
            planId: doc.currentGym.plan?._id || null,
            planName: doc.currentGym.plan?.name || null,
            planPrice: gymPlanData?.price || null, // ✅ now fetched from GymPlan || null,
            membership_start: doc.currentGym.membership_start || null,
            membership_end: doc.currentGym.membership_end || null,
            membership_status: doc.currentGym.status || null,
          }
        : null,

      // Top-level fallback gym (if you keep a top-level gym field)
      gym: doc.gym || null,

      // History & meta
      gymHistory: doc.gymHistory || [],
    };

    return res.json({ success: true, user: flattened });
  } catch (error) {
    console.error("Error in viewuserDetail:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};


export const deleteMemberCurrentGym = async (req, res) => {
  try {
    const { memberId } = req.params;
    const ownerId = req.user.id; // logged-in gym owner

    // 1️⃣ Fetch owner's gym
    const ownerGym = await Gym.findOne({ user: ownerId });
    if (!ownerGym) {
      return res.status(404).json({
        success: false,
        message: "Gym not found for this owner",
      });
    }

    // 2️⃣ Fetch member
    const member = await Member.findById(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    // 3️⃣ Check if member's currentGym matches this gym
    if (!member.currentGym || member.currentGym.gym.toString() !== ownerGym._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Member is not associated with your gym currently.",
      });
    }

    // 4️⃣ Remove currentGym details
    member.currentGym = null;

    // Optional: mark membership_end and fee_status
    member.membership_end = new Date();
    member.fee_status = "pending";

    await member.save();

    return res.status(200).json({
      success: true,
      message: "Member's current gym details removed successfully ✅",
      data: member,
    });
  } catch (err) {
    console.error("❌ Error deleting member current gym:", err);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: err.message,
    });
  }
};


// export const getAttendance = async (req, res) => {
//   try {
//     const { memberId } = req.params;

//     // 1️⃣ Member check
//     const member = await Member.findById(memberId).populate("user", "name email phone");
//     if (!member) {
//       return res.status(404).json({ success: false, message: "Member not found" });
//     }

//     // 2️⃣ Attendance fetch
//     const records = await Attendance.find({ member: memberId })
//       .populate("gym", "gymName location")
//       .sort({ date: -1 })
//       .lean();

//     // 3️⃣ Format records
//     const formatted = records.map(r => ({
//       id: r._id,
//       memberId: r.member,
//       memberName: member.user?.name || "",
//       gymId: r.gym?._id || null,
//       gymName: r.gym?.gymName || "",
//       date: r.date,
//       status: r.status,
//     }));

//     res.json({ success: true, data: formatted });

//   } catch (error) {
//     console.error("Error fetching attendance:", error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };
