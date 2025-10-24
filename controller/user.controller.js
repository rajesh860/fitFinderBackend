import Member from "../models/member.model.js";
import dotenv from "dotenv";
import { GymPlan, Plan } from "../models/planSchema.js";
import { Enquiry } from "../models/gym.Booking.model.js";
import Gym from "../models/gym.model.js";
import Progress from "../models/progess.model.js";
import fs from "fs";
import path from "path";
import User from "../models/user.model.js";
import Attendance from "../models/attendence.model.js";
import { GymHistory } from "../models/gymHistory.model.js";
import GymBooking from "../models/gymBooking.model.js";
import mongoose from "mongoose";
import MembershipHistory from "../models/planHistroy.model.js";
import feesCollectionModel from "../models/feesCollection.model.js";
import { getPresignedUrl } from "../middleware/presigned.js";
import { s3 } from "../config/s3.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
dotenv.config(); // load env variables

// Example controller function

export const getActiveGymMembers = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1️⃣ Find gym of logged-in user
    const gym = await Gym.findOne({ user: userId });
    if (!gym) {
      return res
        .status(404)
        .json({ success: false, message: "Gym not found", data: [] });
    }

    // 2️⃣ Fetch all members of this gym AND exclude 'pending' status
    const members = await Member.find({
      "currentGym.gym": gym._id,
    })
      .populate({
        path: "user",
        match: { status: { $ne: "pending" } }, // ❌ exclude pending users
        select: "name email phone status",
      })
      .populate("currentGym.gym", "gymName")
      .populate("currentGym.plan", "name")
      .lean();

    // 3️⃣ Filter out members whose user is null (because they were pending)
    const filteredMembers = members.filter((m) => m.user);

    // 4️⃣ Format with plan price
    const formatted = await Promise.all(
      filteredMembers.map(async (m) => {
        let planPrice = 0;
        if (m.currentGym?.plan?._id) {
          const gymPlan = await GymPlan.findOne({
            gymId: gym._id,
            planId: m.currentGym.plan._id,
          }).lean();
          planPrice = gymPlan?.price || 0;
        }
        return {
          id: m._id,
          name: m.user?.name || "-",
          email: m.user?.email || "-",
          phone: m.user?.phone || "-",
          plan: m.currentGym?.plan?.name || "-",
          fee_amount: planPrice,
          status: m.user?.status || "-",
          fee_status: m.fee_status || "-",
          registered_at: m.registered_at,
          gym: m.currentGym?.gym?.gymName || "-",
          photo: m.photo ? await getPresignedUrl(m.photo): null,
        };
      })
    );

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error("Error fetching gym members:", error);
    res.status(500).json({ success: false, message: error.message, data: [] });
  }
};

// Route

export const findSignalUser = async (req, res) => {
  try {
    const { id } = req.user;
    // const { gymId } = req.body;

    // User aur Member fetch karo, gym aur plan dono populate
    // const userData = await User.findById(id).lean()
    const userProfile = await Member.findOne({ user: id })
      .populate("user", "name email phone") // plan ka name chahiye
      .populate("currentGym.gym", "gymName contact address plan") // plan ka name chahiye
      .populate("currentGym.plan", "name duration")
      .lean();
    const progress = await Progress.findOne({
      member: userProfile?._id,
    }).lean();
    // console.log(progress, "progress");

    //    const attendance = await Attendance.findOne({
    //   member: id,
    //   gym: gymId,
    //   // date: { $gte: todayStart, $lte: todayEnd },
    // }).populate("gym", "gymName") // Gym ka naam bhi populate kar sakte ho
    //   .sort({ date: -1 }).lean();
        // const userProfile2 = await Member.findOne({ user: id })
    if (!userProfile) {
      return res.status(404).json({ message: "User not found" });
    }

    const mergedUser = {
      // ...userData,
      progress: progress?.current || null,
      planName: userProfile?.currentGym?.plan.name,
      name: userProfile?.user?.name,
      email: userProfile?.user?.email,
      phone: userProfile?.user?.phone,
      gymName: userProfile?.currentGym?.gym?.gymName,
      gymStatus: userProfile?.currentGym?.status,
      membership_start: userProfile?.currentGym?.membership_start,
      membership_end: userProfile?.currentGym?.membership_end,
      // currentGym:{...userProfile?.currentGym?.gym},
      ...userProfile,
      // attendance:attendance || null,
      photo: userProfile.photo
        ? await getPresignedUrl(userProfile.photo)
        : null,
      // plan: userProfile.plan?.name || null, // populate ke baad name milega
    };
    res.json(mergedUser);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// export const findSignalUser = async (req, res) => {
//   try {
//     const { id } = req.user;

//     // 1️⃣ Fetch Member with populated user, gym, plan
//     const userProfile = await Member.findOne({ user: id })
//       .populate("user", "name email phone") // User info
//       .populate("currentGym.gym", "gymName contact address") // Gym info
//       .populate({
//         path: "currentGym.plan",
//         select: "name duration",
//       })
//       .lean();

//     if (!userProfile) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     // 2️⃣ Fetch member's progress
//     const progress = await Progress.findOne({ member: userProfile._id }).lean();

//     // 3️⃣ Merge data for response
//     const mergedUser = {
//       memberId: userProfile._id,
//       name: userProfile.user?.name,
//       email: userProfile.user?.email,
//       phone: userProfile.user?.phone,
//       gymName: userProfile.currentGym?.gym?.gymName || null,
//       gymStatus: userProfile.currentGym?.status || null,
//       membership_start: userProfile.currentGym?.membership_start || null,
//       membership_end: userProfile.currentGym?.membership_end || null,
//       planName: userProfile.currentGym?.plan?.name || null,
//       planDuration: userProfile.currentGym?.plan?.duration || null,
//       progress: progress?.current || null,
//       photo: userProfile.photo
//         ? `${process.env.DOMAIN}/${userProfile.photo}`
//         : null,
//       // Optional: Include other member fields if needed
//       medical_conditions: userProfile.medical_conditions || [],
//       injuries: userProfile.injuries || [],
//       fitness_goals: userProfile.fitness_goals || [],
//       emergency_contacts: userProfile.emergency_contacts || [],
//       fee_status: userProfile.fee_status || null,
//       currentGym: userProfile.currentGym || null,
//     };

//     return res.json({ success: true, data: mergedUser });
//   } catch (error) {
//     console.error("❌ Error fetching user profile:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server Error",
//       error: error.message,
//     });
//   }
// };

export const getUserAttendence = async (req, res) => {
  const { id } = req.user;
  const { gymId } = req.params;

  try {
    const getMember = await Member.findOne({ user: id }).populate(
      "user",
      "name photo"
    );
    const user = {
      userPhoto:await getPresignedUrl(getMember.photo),
      name: getMember.user?.name || "",
    };
    const attendance = await Attendance.find({
      member: getMember?._id,
      gym: gymId,
      // date: { $gte: todayStart, $lte: todayEnd },
    })
      .populate("gym", "gymName") // Gym ka naam bhi populate kar sakte ho
      .sort({ date: -1 })
      .lean();
    res.json({ data: attendance, status: true, user });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getUserProgressByGym = async (req, res) => {
  try {
    // ✅ Find member linked to logged-in user
    const member = await Member.findOne({ user: req.user.id });
    if (!member)
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });

    const memberId = member._id;
    const { gymId } = req.params;

    // ✅ Fetch progress
    const progress = await Progress.findOne({ member: memberId, gym: gymId })
      .populate("gym", "gymName location")
      .populate("current.updatedBy", "name")
      .populate("history.updatedBy", "name")
      .lean();

    if (!progress)
      return res
        .status(404)
        .json({ success: false, message: "No progress found for this gym" });

    res.json({
      success: true,
      data: {
        current: progress.current,
        history: progress.history,
        gym: progress.gym,
      },
    });
  } catch (error) {
    console.error("❌ getUserProgressByGym error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getUserGymHistory = async (req, res) => {
  try {
    const memberId = req.user?.id;

    // 1️⃣ Fetch the member
    const member = await Member.findOne({ user: memberId }).lean();
    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });
    }

    // 2️⃣ Fetch gymHistory documents using the IDs in member.gymHistory
    const gymHistory = await GymHistory.find({
      _id: { $in: member.gymHistory },
    })
      .populate("gym", "gymName location")
      .populate("plan", "name duration") // ✅ plan ka name aur duration
      .sort({ membership_start: -1 }); // latest first

    // 3️⃣ Include currentGym as well
    let currentGymData = null;
    if (member.currentGym && member.currentGym.gym) {
      const gymInfo = await Gym.findById(member.currentGym.gym)
        .select("gymName location")
        .lean();
      const planInfo = member.currentGym.plan
        ? await Plan.findById(member.currentGym.plan)
            .select("name duration")
            .lean()
        : null;

      currentGymData = {
        ...member.currentGym,
        gym: gymInfo,
        plan: planInfo, // ✅ plan ka name include
      };
    }

    res.json({
      success: true,
      currentGym: currentGymData,
      gymHistory,
    });
  } catch (error) {
    console.error("Error fetching gym history:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// PUT /api/member/profile
export const updateUserProfile = async (req, res) => {
  try {
    const memberId = req.params.id;
    const allowedFields = [
      "name","email","phone","dob","address","blood_group",
      "medical_conditions","injuries","fitness_goals",
      "emergency_contacts","referred_by","occupation",
      "notes","gender",
    ];

    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    const getUser = await Member.findById(memberId);
    if (!getUser) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    // ✅ Handle new photo upload
    if (req.files && req.files.photo && req.files.photo[0]) {
      const newPhoto = req.files.photo[0].key;

      // 🔥 Delete old photo from S3 if exists
      if (getUser.photo) {
        let oldKey = getUser.photo.split(`${process.env.AWS_BUCKET_NAME}/`)[1]; 
        if (!oldKey) {
          oldKey = getUser.photo.split("uploads/")[1];
        }

        if (oldKey) {
          const command = new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME, // jaise "fitcrewimages"
            Key: `uploads/${oldKey}`, // S3 me actual path
          });
          await s3.send(command);
          // console.log("Old photo deleted from S3:", oldKey);
        }
      }

      // ✅ Set new photo
      updateData.photo = newPhoto;
    }

    // ✅ Update user's phone in User collection
    if (updateData.phone) {
      await User.findByIdAndUpdate(getUser.user, { phone: updateData.phone });
      delete updateData.phone;
    }

    const updatedMember = await Member.findByIdAndUpdate(
      memberId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedMember,
    });
  } catch (err) {
    console.error("Error updating profile:", err.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const gymApply = async (req, res) => {
  try {
    const { gymId } = req.params;
    const memberId = req.user?.id;
    // 1️⃣ Check if gym exists
    const gym = await Gym.findById(gymId);
    if (!gym) {
      return res.status(404).json({ success: false, message: "Gym not found" });
    }

    // 2️⃣ Fetch the member
    const member = await Member.findOne({ user: memberId });
    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });
    }

    // 3️⃣ Prevent duplicate gym application
    if (member.currentGym?.gym?.toString() === gym._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You are already registered in this gym",
      });
    }

    // 4️⃣ Check if already applied and pending
    const existingRequest = await GymBooking.findOne({
      user: member.user,
      gym: gym._id,
      status: "pending",
    });
    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message:
          "You have already applied to this gym and it's pending approval",
      });
    }

    // 5️⃣ Create new gym application request
    const gymRequest = await GymBooking.create({
      user: member.user,
      gym: gym._id,
      status: "pending",
    });

    res.json({
      success: true,
      message: `Gym application submitted for ${gym.gymName}. Waiting for approval.`,
      data: gymRequest,
    });
  } catch (err) {
    console.error("Error in gymApply:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

// controller/user.controller.js
export const approveGymBooking = async (req, res) => {
  try {
    const { requestId } = req.params;
    const ownerId = req.user?.id;
    const {
      planId,
      totalAmount,
      paidAmount,
      paymentMode,
      remark,
      isManual,
      startDate: manualStartDate,
      endDate: manualEndDate,
    } = req.body;

    // 1️⃣ Owner's Gym
    const ownerGym = await Gym.findOne({ user: ownerId });
    if (!ownerGym) {
      return res
        .status(404)
        .json({ success: false, message: "Gym not found for this owner" });
    }

    // 2️⃣ Booking Request
    const request = await GymBooking.findById(requestId).populate("user gym");
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Booking request not found" });
    }

    // 3️⃣ Authorization
    if (request.gym.user.toString() !== ownerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to approve this booking",
      });
    }

    // 4️⃣ Member
    const member = await Member.findOne({ user: request.user._id });
    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found for this user" });
    }
    // 5️⃣ Validate Plan
    const gymPlan = await GymPlan.findOne({
      gymId: request.gym._id,
      _id: planId,
    }).populate("planId", "name durationInMonths");
    if (!gymPlan) {
      return res.status(400).json({
        success: false,
        message: "Invalid or unavailable plan for this gym",
      });
    }

    // 6️⃣ Expire old membership
    if (member.currentGym?.gym) {
      await MembershipHistory.updateMany(
        {
          member: member._id,
          gym: member.currentGym.gym,
          plan: member.currentGym.plan,
          status: "active",
        },
        { $set: { status: "expired" } }
      );
      member.currentGym.status = "expired";
    }

    // 7️⃣ Set Membership Dates
    let startDate = new Date();
    let endDate = new Date();

    if (isManual && manualStartDate && manualEndDate) {
      // ✅ Manual dates from frontend
      startDate = new Date(manualStartDate);
      endDate = new Date(manualEndDate);
    } else {
      // ✅ Auto calculate based on plan duration
      const durationMonths = parseInt(gymPlan.planId.durationInMonths, 10) || 1;
      endDate.setMonth(endDate.getMonth() + durationMonths);
    }

    // 8️⃣ Update Current Membership
    member.currentGym = {
      gym: request.gym._id,
      plan: gymPlan.planId._id,
      membership_start: startDate,
      membership_end: endDate,
      status: "active",
    };

    // 9️⃣ Save member initially
    await member.save();

    // 🔟 Membership History
    await MembershipHistory.create({
      member: member._id,
      gym: request.gym._id,
      plan: gymPlan.planId._id,
      membership_start: startDate,
      membership_end: endDate,
      status: "active",
    });

    // 1️⃣1️⃣ Fee Collection
    const pendingAmount = totalAmount - paidAmount;
    await feesCollectionModel.create({
      member: member._id,
      gym: request.gym._id,
      planName: gymPlan.planId.name,
      totalAmount,
      paidAmount,
      pendingAmount,
      startDate,
      endDate,
      status: pendingAmount > 0 ? "pending" : "completed",
      payments: [
        {
          amount: paidAmount,
          date: new Date(),
          mode: paymentMode,
          remark,
        },
      ],
    });

    // 1️⃣2️⃣ Update member fee_status
    if (pendingAmount <= 0) {
      member.fee_status = "paid";
    } else if (paidAmount > 0) {
      member.fee_status = "pending";
    } else {
      member.fee_status = "overdue";
    }
    await member.save();

    // 1️⃣3️⃣ Delete Booking Request
    await GymBooking.findByIdAndDelete(requestId);

    // 1️⃣4️⃣ Response
    return res.status(200).json({
      success: true,
      message: `✅ Booking approved with ${gymPlan.planId.name}. ₹${paidAmount} collected.`,
      data: {
        memberId: member._id,
        gymId: request.gym._id,
        planName: gymPlan.planId.name,
        membership_start: startDate,
        membership_end: endDate,
        totalAmount,
        paidAmount,
        pendingAmount,
        feeStatus: member.fee_status,
      },
    });
  } catch (err) {
    console.error("❌ Error in approveGymBooking:", err);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: err.message,
    });
  }
};


export const rejectGymBooking = async (req, res) => {
  try {
    const { requestId } = req.params;
    const ownerId = req.user?.id;

    // 1️⃣ Fetch request
    const request = await GymBooking.findById(requestId).populate("gym");
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Booking request not found" });
    }

    // 2️⃣ Check authorization
    if (request.gym.user.toString() !== ownerId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to reject this booking",
      });
    }

    // 3️⃣ Delete booking request
    await GymBooking.findByIdAndDelete(requestId);

    res.json({
      success: true,
      message: "🚫 Booking request rejected and removed successfully",
    });
  } catch (err) {
    console.error("Error in rejectGymBooking:", err);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: err.message });
  }
};

export const getGymBookingRequests = async (req, res) => {
  try {
    const ownerId = req.user?.id;

    // 1️⃣ Find all gyms owned by the logged-in user
    const gyms = await Gym.find({ user: ownerId }).select(
      "_id gymName location"
    );

    if (!gyms.length) {
      return res.status(404).json({
        success: false,
        message: "No gyms found for this owner",
        data: { pending: [], approved: [], rejected: [] },
      });
    }

    const gymIds = gyms.map((g) => g._id);

    // 2️⃣ Fetch booking requests related to these gyms
    // const requests = await GymBooking.find({ gym: { $in: gymIds } })
    //   .populate({
    //     path: "user",
    //     select: "name email photo",
    //   })
    //   .populate("gym", "gymName location")
    //   .sort({ createdAt: -1 })
    //   .lean();
    const requests = await GymBooking.find({ gym: { $in: gymIds } }).populate({
      path: "user",
      select: "-password", // 👈 Exclude password from user
    });

    // 4️⃣ Send structured response
    res.status(200).json({
      success: true,
      message: "Booking requests fetched successfully",
      data: requests,
    });
  } catch (err) {
    console.error("Error fetching booking requests:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
      data: requests,
    });
  }
};

export const addProgressUserByGym = async (req, res) => {
  try {
    const { memberId } = req.params; // Member ID
    const gymOwnerId = req.user.id; // Logged-in gym owner/trainer
    const { weight, height, arm, waist, thigh, chest, bloodGroup } = req.body;

    // ✅ Step 1: Find the gym of this owner
    const gym = await Gym.findOne({ user: gymOwnerId });
    if (!gym) {
      return res
        .status(404)
        .json({ success: false, message: "Gym not found for this owner" });
    }

    // ✅ Step 2: Find or create progress document
    let progress = await Progress.findOne({ member: memberId, gym: gym._id });

    if (!progress) {
      // Create new progress
      progress = new Progress({
        member: memberId,
        gym: gym._id,
        current: {
          weight,
          height,
          arm,
          waist,
          thigh,
          chest,
          bloodGroup,
          updatedBy: gymOwnerId,
        },
      });
    } else {
      // Push old current to history
      progress.history.push({ ...progress.current });

      // Update current
      progress.current = {
        weight,
        height,
        arm,
        waist,
        thigh,
        chest,
        bloodGroup,
        updatedBy: gymOwnerId,
        updatedAt: Date.now(),
      };
    }

    await progress.save();

    res.json({ success: true, message: "Progress added/updated successfully" });
  } catch (err) {
    console.error("❌ addProgressUserByGym error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getProgressUserOfGym = async (req, res) => {
  try {
    const { memberId } = req.params;
    const userGymId = req.user.id; // this is User._id (not Gym._id)

    // 1️⃣ Find gym document using the User ID
    const gym = await Gym.findOne({ user: userGymId });
    if (!gym) {
      return res.status(404).json({
        success: false,
        message: "Gym not found for this user",
      });
    }

    // 2️⃣ Now find the progress using memberId + gym._id
    const progress = await Progress.findOne({
      member: memberId,
      gym: gym._id, // ✅ correct reference
    })
      .populate("member", "user") // populate member.user
      .populate("gym", "gymName") // populate gym name
      .select("-__v"); // optional cleanup

    if (!progress) {
      return res.status(200).json({
        success: false,
        message: "Progress not found for this member in this gym",
      });
    }

    res.json({ success: true, data: progress });
  } catch (err) {
    console.error("Error in getProgressUserOfGym:", err);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: err.message,
    });
  }
};

export const changeUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // naya status client se aayega

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const user = await Member.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.fee_status = status; // status update
    await user.save();

    res.json({ message: "Status updated successfully", user });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const userGymEnquiry = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { gymId, date, time } = req.body;

    if (!gymId || !date || !time) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    // ✅ Check if active enquiry already exists (pending / upcoming only)
    const existingEnquiry = await Enquiry.findOne({
      userId,
      gymId,
      status: { $in: ["pending", "upcoming"] },
    });

    if (existingEnquiry) {
      return res.status(400).json({
        success: false,
        message: "You already have an active enquiry for this gym",
      });
    }

    // ✅ Generate unique 6-character alphanumeric code
    const generateUniqueNumber = () => {
      const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let result = "";
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    const uniqueNumber = generateUniqueNumber();

    const booking = new Enquiry({ gymId, date, time, userId, uniqueNumber });
    await booking.save();

    res.status(201).json({
      success: true,
      message: "Trial Booking Submitted",
      uniqueNumber,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getUserGymEnquiry = async (req, res) => {
  try {
    const { id: userId } = req.user; // Get logged-in user's ID from auth middleware
    console.log(userId);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Fetch all enquiries for this user
    const enquiries = await Enquiry.find({ userId }).populate(
      "gymId",
      "gymName address"
    );
    res.status(200).json({
      success: true,
      enquiries,
    });
  } catch (err) {
    console.error("Get User Enquiry Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getGymAdminGymEnquiries = async (req, res) => {
  try {
    const { status } = req.params; // Gym admin's user ID
    const { id } = req.user; // Gym admin's user ID

    // 1️⃣ Find the gym managed by this admin
    const gym = await Gym.findOne({ user: id }); // Assuming gym has email field
    if (!gym) {
      return res
        .status(404)
        .json({ success: false, message: "Gym not found for this admin" });
    }
    const statusArray = status.split(","); // ["pending", "upcoming"]
    // 2️⃣ Get all enquiries for this gym

    const enquiries = await Enquiry.find({
      gymId: gym._id,
      status: { $in: statusArray },
    }).populate("userId", "name email phone gender dob address");

    res.status(200).json({
      success: true,
      data: enquiries,
    });
  } catch (err) {
    console.error("Get Gym Enquiries Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// controllers/enquiryController.js
export const approveEnquiryByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const enquiry = await Enquiry.findById(id).populate("userId");

    if (!enquiry)
      return res
        .status(404)
        .json({ success: false, message: "Enquiry not found" });

    enquiry.status = "upcoming";
    await enquiry.save();

    // ✅ यहां आप notification / SMS / Email भेज सकते हो enquiry.userId.email या phone पर
    // sendNotification(enquiry.userId, "Your trial enquiry is confirmed...");

    res.status(200).json({
      success: true,
      message: "Enquiry approved and user notified",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const cancelEnquiryByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason)
      return res
        .status(400)
        .json({ success: false, message: "Reason is required" });

    const enquiry = await Enquiry.findById(id).populate("userId");
    if (!enquiry)
      return res
        .status(404)
        .json({ success: false, message: "Enquiry not found" });

    enquiry.status = "cancelled";
    enquiry.cancellationReason = reason;
    await enquiry.save();

    // ✅ यहां भी आप notification भेज सकते हो
    // sendNotification(enquiry.userId, `Your booking has been cancelled: ${reason}`);

    res.status(200).json({
      success: true,
      message: "Enquiry cancelled and user notified",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const completeEnquiryByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { uniqueNumber } = req.body;

    if (!uniqueNumber) {
      return res
        .status(400)
        .json({ success: false, message: "Unique number required" });
    }

    const enquiry = await Enquiry.findById(id).populate("userId");
    if (!enquiry) {
      return res
        .status(404)
        .json({ success: false, message: "Enquiry not found" });
    }

    // 🔑 Check if provided number matches enquiry's unique number
    if (enquiry.uniqueNumber !== uniqueNumber) {
      return res.status(400).json({
        success: false,
        message: "Invalid unique number. Completion denied.",
      });
    }

    enquiry.status = "completed";
    await enquiry.save();

    // ✅ Notification भी भेज सकते हो
    // sendNotification(enquiry.userId, "Your trial has been successfully completed.");

    res.status(200).json({
      success: true,
      message: "Enquiry marked as completed successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const enquiryCancelled = async (req, res) => {
  // const { reason } = req.body;  // Optional reason for cancellation
  const { id: userId } = req.user;

  const enquiry = await Enquiry.findOne({ _id: req.params.enquiryId, userId });

  if (!enquiry) return res.status(404).json({ message: "Enquiry not found" });

  if (enquiry.status === "completed") {
    return res
      .status(400)
      .json({ message: "Cannot cancel a completed enquiry" });
  }

  enquiry.status = "cancelled";
  // enquiry.cancellationReason = reason || 'Cancelled by user';
  await enquiry.save();

  res.json({ message: "Enquiry cancelled successfully", enquiry });
};

export const getMembershipHistory = async (req, res) => {
  try {
    const { gymId, memberId } = req.query;
// console.log(gymId,"vhbjnm")
    // 🔹 gymId mandatory
    if (!gymId) {
      return res.status(400).json({
        success: false,
        message: "gymId query parameter is required",
      });
    }

    let targetMemberId;

    // 🔹 Role-based access
    if (req.user.userRole === "member") {
      targetMemberId = req.user.id; // member can see only own history
    } else if (req.user.userRole === "admin" || req.user.userRole === "gym") {
      if (!memberId) {
        return res.status(400).json({
          success: false,
          message: "memberId query parameter is required for admin/gym",
        });
      }
      targetMemberId = memberId; // admin/gym can see any member's history
    } else {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }
    console.log(targetMemberId,req.user,"targetMemberId")

    // 🔹 Fetch member
    const checkUserRole = req.user.userRole === "member"
    const para = checkUserRole?{user:targetMemberId }:{_id:targetMemberId}
    const member = await Member.findOne(para);
    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });
    }

    // 🔹 Fetch membership history for the gym
    const history = await MembershipHistory.find({
      member: member?._id,
      gym: gymId,
    })
      .populate("gym", "gymName")
      .populate("plan", "name")
      .sort({ purchasedAt: -1 });

    return res.json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (err) {
    console.error("Error fetching history:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};





export const getClientDashboard = async (req, res) => {
  try {
    console.log("Dashboard API Hit ✅");

    const { id } = req.user; // userId from token

    // ✅ Populate full gym details + status included
    const user = await Member.findOne({ user: id })
      .populate("user", "name email userRole")
      .populate({
        path: "currentGym.gym",
        model: "Gym",
        select: "gymName images avgRating location contact",
      })
      .populate({
        path: "currentGym.plan",
        select: "name durationDays",
      });

    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    if (user.user.userRole !== "member" && user.user.userRole !== "demo")
      return res
        .status(403)
        .json({ success: false, message: "Access denied: Not a member" });

    // 🔹 Attendance
    const allAttendance = await Attendance.find({ member: user._id }).sort({
      date: -1,
    });
    const totalDays = allAttendance.length;
    const presentDays = allAttendance.filter(
      (a) => a.status === "present"
    ).length;
    const today = new Date().setHours(0, 0, 0, 0);
    const presentToday = allAttendance.some(
      (a) =>
        new Date(a.date).setHours(0, 0, 0, 0) === today &&
        a.status === "present"
    );

    // 🔹 Calculate Streak
    let streakDays = 0;
    for (let i = 0; i < allAttendance.length; i++) {
      const current = new Date(allAttendance[i].date).setHours(0, 0, 0, 0);
      const compareDate = new Date(
        today - streakDays * 24 * 60 * 60 * 1000
      ).setHours(0, 0, 0, 0);
      if (current === compareDate && allAttendance[i].status === "present")
        streakDays++;
      else break;
    }

    // 🔹 Progress
    const progress = await Progress.findOne({ member: user._id }).populate(
      "gym",
      "name"
    );
    let progressPercent = 0;

    if (progress?.current?.weight && progress?.history?.length) {
      const startWeight =
        progress.history[0]?.weight || progress.current.weight;
      const currentWeight = progress.current.weight;
      const targetWeight = progress.current.targetWeight || currentWeight - 5;

      if (startWeight !== targetWeight) {
        progressPercent = Math.min(
          100,
          Math.round(
            ((startWeight - currentWeight) / (startWeight - targetWeight)) * 100
          )
        );
      }
    }

    const bodyMeasurements = {
      chest: progress?.current?.chest || null,
      weight: progress?.current?.weight || null,
      height: progress?.current?.height || null,
      biceps: progress?.current?.arm || null,
      thigh: progress?.current?.thigh || null,
    };

    // 🔹 Current Plan + Gym Details (status included)
    const currentGym = user.currentGym;
    let planData = null;

    if (currentGym?.plan) {
      const membershipStart = new Date(currentGym.membership_start);
      const membershipEnd = new Date(currentGym.membership_end);
      const todayDate = new Date();

      const totalPlanDays = Math.ceil(
        (membershipEnd.getTime() - membershipStart.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const daysLeft = Math.max(
        0,
        Math.ceil(
          (membershipEnd.getTime() - todayDate.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );

      planData = {
        name: currentGym.plan.name,
        totalDays: totalPlanDays,
        daysLeft,
       planId:currentGym.plan?._id,
        gymDetails: {
           status: currentGym.status || "inactive", // ✅ included here
          name: currentGym.gym?.gymName || "N/A",
          contact: currentGym.gym?.contact || "N/A",
          avgRating: currentGym.gym?.avgRating || 0,
          totalReviews: currentGym.gym?.totalReviews || 0,
          location: currentGym.gym?.location || null,
          images: currentGym.gym?.images || [],
        },
      };
    }

    // 🔹 Tip of the Day
    const tips = [
      "Stay consistent — even small efforts count!",
      "Progress over perfection 💪",
      "Fuel your body, not your excuses.",
      "You’re stronger than you think!",
    ];
    const tip = tips[Math.floor(Math.random() * tips.length)];

    // ✅ Final Response
    res.status(200).json({
      success: true,
      data: {
        memberName: user.user.name,
        memberId: user._id,
        attendance: {
          total: totalDays,
          present: presentDays,
          presentToday,
          streakDays,
        },
        progress: {
          percent: progressPercent,
          goal: progress?.goal || "Muscle Gain",
          currentWeight: progress?.current?.weight || null,
          targetWeight: progress?.current?.targetWeight || null,
          ...bodyMeasurements,
        },
        plan: planData,
        tip,
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

