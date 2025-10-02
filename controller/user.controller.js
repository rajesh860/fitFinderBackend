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
dotenv.config(); // load env variables

// Example controller function

// ✅ GET Users for table
export const getUsers = async (req, res) => {
  try {
    // Logged-in user id
    const userId = req.user.id;

    // 1️⃣ Find the member profile of logged-in user
    const findUser = await Gym.findOne({ user: userId });
    console.log(findUser, "findUser");
    const memberProfile = await Member.findOne({
      "currentGym.gym": findUser?._id,
    })
      .populate("user", "name email phone")
      .lean();
    if (!memberProfile || !memberProfile.currentGym?.gym) {
      return res.status(200).json({
        success: false,
        message: "User Not Found",
        data: [],
      });
    }

    const gymId = memberProfile.currentGym.gym;
    // console.log("Gym ID:", gymId);

    // 2️⃣ Fetch all members of the same gym
    const users = await Member.find({ "currentGym.gym": gymId })
      .populate("currentGym.gym", "gymName") // gym ka naam
      .populate("currentGym.plan", "name") // ✅ plan ka name
      .populate("user") // user info
      .lean();

    // 3️⃣ Format data
    const formatted = users.map((u) => ({
      id: u._id,
      name:
        u.user.name || `${u.user.first_name || ""} ${u.user.last_name || ""}`,
      email: u.user.email,
      phone: u.user.phone,
      plan: u.currentGym?.plan?.name || "-", // ✅ plan ka name ab aayega
      fee_amount: u.fee_amount || 0,
      status: u.status || "-",
      fee_status: u.fee_status || "-",
      registered_at: u.registered_at,
      gym: u.currentGym?.gym?.gymName || "-",
      photo: u.photo ? `${process.env.DOMAIN}/${u.photo}` : null,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error("Error fetching gym users:", error);
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
        ? `${process.env.DOMAIN}/${userProfile.photo}`
        : null,
      // plan: userProfile.plan?.name || null, // populate ke baad name milega
    };
    res.json(mergedUser);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getUserAttendence = async (req, res) => {
  const { id } = req.user;
  const { gymId } = req.params;

  try {
    const attendance = await Attendance.find({
      member: id,
      gym: gymId,
      // date: { $gte: todayStart, $lte: todayEnd },
    })
      .populate("gym", "gymName") // Gym ka naam bhi populate kar sakte ho
      .sort({ date: -1 })
      .lean();
    res.json({ data: attendance, status: true });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
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
      "name",
      "email",
      "phone",
      "dob",
      "address",
      "blood_group",
      "medical_conditions",
      "injuries",
      "fitness_goals",
      "emergency_contacts",
      "referred_by",
      "occupation",
      "notes",
      "gender",
    ];

    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    // ✅ Fetch current user
    const getUser = await Member.findOne({ _id: memberId });
    console.log(getUser, memberId, "getUser");
    // console.log(getUser,memberId,"getUser")
    if (!getUser) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });
    }

    // ✅ If new photo uploaded
    if (req.file) {
      // 🔥 Delete old photo if exists
      // if (getUser.photo) {
      //   const oldPhotoPath = path.join(process.cwd(), getUser.photo); // resolve full path
      //   if (fs.existsSync(oldPhotoPath)) {
      //     fs.unlinkSync(oldPhotoPath);
      //     console.log("Old photo deleted:", oldPhotoPath);
      //   }
      // }
      // ✅ Set new photo path
      updateData.photo = req.file.path;
    }
    console.log(updateData, "bjnkm");
    // ✅ Update user
    const updatedMember = await Member.findByIdAndUpdate(
      getUser?._id,
      { $set: updateData },
      { new: true, runValidators: true } // runValidators ensures enum check
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
    console.log(gymId, memberId);

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
    const { planId } = req.body; // frontend se planId aa rahi hai

    console.log("🔹 Params:", { requestId, ownerId, planId });

    // 1️⃣ Fetch owner's gym
    const ownerGym = await Gym.findOne({ user: ownerId });
    if (!ownerGym) {
      return res
        .status(404)
        .json({ success: false, message: "Gym not found for this owner" });
    }

    // 2️⃣ Fetch specific booking request
    const request = await GymBooking.findById(requestId).populate("user gym");
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Booking request not found" });
    }

    // 3️⃣ Authorization check
    if (request.gym.user.toString() !== ownerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to approve this booking",
      });
    }

    // 4️⃣ Fetch member
    const member = await Member.findOne({ user: request.user._id });
    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found for this user" });
    }

    // 5️⃣ Verify GymPlan
    const gymPlan = await GymPlan.findOne({
      gymId: request.gym._id,
      planId,
    }).populate("planId", "name durationInMonths");
    if (!gymPlan) {
      return res.status(400).json({
        success: false,
        message: "Invalid or unavailable plan for this gym",
      });
    }

    // 6️⃣ Move current gym to history if exists
    if (member.currentGym?.gym) {
      const history = await GymHistory.create({
        member: member._id,
        gym: member.currentGym.gym,
        plan: member.currentGym.plan || null,
        membership_start: member.currentGym.membership_start,
        membership_end: member.currentGym.membership_end,
        status: "expired",
      });
      member.gymHistory.push(history._id);
    }

    // 7️⃣ Set new membership start and end dates
    const startDate = new Date(); // Today = approval date
    const durationMonths = parseInt(gymPlan.durationInMonths, 10) || 1;
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + durationMonths);

    member.currentGym = {
      gym: request.gym._id,
      plan: gymPlan.planId,
      membership_start: startDate,
      membership_end: endDate,
      status: "active",
    };
    // ✅ Mark fee as paid
    member.fee_status = "paid";

    await member.save();

    // 8️⃣ Delete booking request after approval
    await GymBooking.findByIdAndDelete(requestId);

    // ✅ Final response
    res.json({
      success: true,
      message: `✅ Booking approved successfully with ${
        gymPlan.planId.name || "selected"
      } plan. Membership starts today and ends after ${durationMonths} month(s).`,
      data: member,
    });
  } catch (err) {
    console.error("❌ Error in approveGymBooking:", err);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: err.message });
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
    const { memberId } = req.params;

    const gymId = req.user.id; // assuming gym owner/trainer is logged in
    const { weight, height, arm, waist, thigh, chest, bloodGroup } = req.body;

    let progress = await Progress.findOne({ member: memberId, gym: gymId });
    if (!progress) {
      progress = new Progress({
        member: memberId,
        gym: gymId,
        current: {
          chest,
          weight,
          height,
          arm,
          waist,
          thigh,
          bloodGroup,
          updatedBy: req.user.id,
        },
      });
    } else {
      // Push old current to history
      progress.history.push({ ...progress.current });
      // Update current
      progress.current = {
        weight,
        chest,
        height,
        arm,
        waist,
        thigh,
        bloodGroup,
        updatedBy: gymId,
      };
    }

    await progress.save();
    res.json({ success: true, message: "Progress Added Successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getProgressUserOfGym = async (req, res) => {
  try {
    const { memberId } = req.params;
    const gymId = req.user.id; // or check authorization
    const progress = await Progress.findOne({ member: memberId, gym: gymId })
      .select("-member")
      .populate("gym", "name");
    if (!progress)
      return res
        .status(200)
        .json({ success: false, message: "Progress not found" });
    res.json({ success: true, data: progress });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
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

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Fetch all enquiries for this user
    const enquiries = await Enquiry.find({ userId }).populate(
      "gymId",
      "name address"
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
    const gym = await Gym.find({ user: id }); // Assuming gym has email field
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
    }).populate(
      "userId",
      "first_name last_name email phone gender dob address"
    );
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
