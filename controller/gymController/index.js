import Member from "../../models/member.model.js";
import Attendance from "../../models/attendence.model.js";
import Progress from "../../models/progess.model.js";
import { GymPlan } from "../../models/planSchema.js";
import Gym from "../../models/gym.model.js";
import MembershipHistory from "../../models/planHistroy.model.js";
import { getPresignedUrl } from "../../middleware/presigned.js";

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

    // const getAttendance = await Attendance.find({
    //   member: id,
    //   gym: doc?.currentGym?.gym?._id,
    // });
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
      photo: doc.photo ? await getPresignedUrl(doc.photo) : null,
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
            // attendance: getAttendance,
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
    if (
      !member.currentGym ||
      member.currentGym.gym.toString() !== ownerGym._id.toString()
    ) {
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


export const getMemberAttendance = async (req, res) => {
  try {
    const { memberId, membershipId } = req.params;

    // 1️⃣ Get membership history
    const membership = await MembershipHistory.findById(membershipId);
    if (!membership) {
      return res.status(404).json({ success: false, message: "Membership not found" });
    }

    const startDate = membership.membership_start;
    const endDate = membership.membership_end;

    // 2️⃣ Fetch attendance within membership period
    const attendance = await Attendance.find({
      member: memberId,
      gym: membership.gym,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    // 3️⃣ Response
    return res.status(200).json({
      success: true,
      data: {
        membership: {
          membershipId: membership._id,
          plan: membership.plan,
          startDate,
          endDate,
          status: membership.status,
        },
        attendance,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};


// export const getPlanHistory = async (req, res) => {
//   try {
//     const {id} = req.user
//     const { memberId } = req.body;

//     // ✅ Validate required fields
//     if (!gymId || !memberId) {
//       return res.status(400).json({ message: "gymId and memberId are required" });
//     }

//     // ✅ Find gym and member
//     const findGym = await Gym.findOne({ user: id });
//     const findMember = await Member.findOne({ _id: memberId });

//     if (!findGym) {
//       return res.status(404).json({ message: "Gym not found" });
//     }
//     if (!findMember) {
//       return res.status(404).json({ message: "Member not found" });
//     }

//     // ✅ Fetch plan history
//     const planHistory = await MembershipHistory.find({
//       gym: findGym._id,
//       member: findMember._id,
//     }).populate("plan") // optional: populate plan details
//       .populate("gym")
//       .populate("member");

//     return res.status(200).json({
//       success: true,
//       message: "Plan history fetched successfully",
//       data: planHistory,
//     });

//   } catch (error) {
//     console.error("Error fetching plan history:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };
