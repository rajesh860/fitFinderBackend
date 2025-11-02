import User from "../../models/user.model.js";
import Admin from "../../models/admin.model.js";
import Gym from "../../models/gym.model.js";
import Member from "../../models/member.model.js";
import { generateOtp, sendOtpEmail } from "../otpService.js";
import { GymPlan } from "../../models/planSchema.js";
import dayjs from "dayjs";
import MembershipHistory from "../../models/planHistroy.model.js";
import feesCollectionModel from "../../models/feesCollection.model.js";
import Trainer from "../../models/trainer.model.js"
export const requestOtp = async (req, res) => {
  try {
    const { name, email, phone, password, userRole, gymName } = req.body;
    // 🔒 Admin check: only one admin allowed
    // if (userRole === "admin") {
    //   const adminExist = await User.findOne({ userRole: "admin" });
    //   if (adminExist) {
    //     return res.status(400).json({
    //       success: false,
    //       message: "Admin account already exists. Cannot create another.",
    //     });
    //   }
    // }

    // 🔍 Email existence check (for gym, member, admin)
    const exist = await User.findOne({ email });
    if (exist) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered" });
    }

    // 🔢 Generate OTP
    const otp = generateOtp();
    const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes

    // 🧠 Store OTP and user data in temporary memory
    req.app.locals.tempOtpStore = req.app.locals.tempOtpStore || {};
    req.app.locals.tempOtpStore[email] = {
      name,
      email,
      phone,
      password,
      userRole,
      otp,
      expiry,
      gymName, // 👈 store gymName also
    };

    // ✉️ Send OTP email
    await sendOtpEmail(email, otp);

    // ✅ Send response with OTP expiry info
    return res.json({
      success: true,
      message: "OTP sent to email. Valid for 5 minutes.",
      otpExpiry: expiry,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const tempUser = req.app.locals.tempOtpStore?.[email];

    if (!tempUser) {
      return res
        .status(400)
        .json({ success: false, message: "No OTP request found" });
    }

    if (tempUser.expiry < Date.now()) {
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    if (tempUser.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // 🔢 Generate userId (starting from 100)
    const lastUser = await User.findOne().sort({ userId: -1 }).select("userId");
    const newUserId = lastUser && lastUser.userId ? lastUser.userId + 1 : 100;

    // 🧠 Create user object
    const userData = {
      userId: newUserId,
      name: tempUser.name,
      email: tempUser.email,
      phone: tempUser.phone,
      password: tempUser.password, // ⚠️ hash before saving (bcrypt)
      userRole: tempUser.userRole,
    };

    // 🏋️ If user is gym, set status = pending
    if (tempUser.userRole === "gym") {
      userData.status = "pending";
    }

    // 💾 Save User in DB
    const user = new User(userData);
    await user.save();

    // 🧩 Role-based profile creation
    if (tempUser.userRole === "gym") {
      await new Gym({ user: user._id, gymName: tempUser.gymName }).save();
    } else if (tempUser.userRole === "member") {
      await new Member({ user: user._id }).save();
    } else if (tempUser.userRole === "admin") {
      await new Admin({ user: user._id }).save();
    }

    // 🧹 Clean temp store
    delete req.app.locals.tempOtpStore[email];

    // ✅ Custom response for gym registration
    if (tempUser.userRole === "gym") {
      return res.json({
        success: true,
        userRole: "gym",
        userId: newUserId,
        message:
          "Your registration request has been submitted successfully. Your account will be activated within 4 hours as per our rules and guidelines.",
      });
    }

    // ✅ Default success message for other roles
    return res.json({
      success: true,
      userId: newUserId,
      message: "Registration successful",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};



export const userRegisterByAdmin = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      userRole,
      planId,
      totalAmount,
      paidAmount,
      paymentMode,
      remark,
      isManual,
      manualStartDate,
      manualEndDate,
    } = req.body;

    const adminId = req.user.id;

    // 🏋️ Get admin gym
    const adminGym = await Gym.findOne({ user: adminId });
    if (!adminGym) {
      return res.status(404).json({
        success: false,
        message: "Admin gym not found. Please create gym first.",
      });
    }

    // 🔍 Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered" });
    }

    // 🔢 Generate sequential userId (starting from 100)
    const lastUser = await User.findOne().sort({ userId: -1 }).select("userId");
    const newUserId = lastUser && lastUser.userId ? lastUser.userId + 1 : 100;

    // 👤 Create new user
    const newUser = await User.create({
      userId: newUserId,
      name,
      email,
      phone,
      password, // ⚠️ hash this before saving if not already
      userRole,
      isVerified: true,
    });

    // 🧾 Get selected plan
    const gymPlan = await GymPlan.findById(planId).populate(
      "planId",
      "name durationInMonths"
    );
    if (!gymPlan) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid plan selected" });
    }

    // 📅 Membership Dates
    let membershipStart, membershipEnd;
    if (isManual && manualStartDate && manualEndDate) {
      membershipStart = new Date(manualStartDate);
      membershipEnd = new Date(manualEndDate);
    } else {
      membershipStart = new Date();
      const durationMonths = parseInt(gymPlan.planId.durationInMonths, 10) || 1;
      membershipEnd = new Date(membershipStart);
      membershipEnd.setMonth(membershipEnd.getMonth() + durationMonths);
    }

    // 🧍‍♂️ Create member record
    const newMember = await Member.create({
      user: newUser._id,
      currentGym: {
        gym: adminGym._id,
        plan: gymPlan.planId._id,
        membership_start: membershipStart,
        membership_end: membershipEnd,
        status: "active",
      },
      membership_start: membershipStart,
      membership_end: membershipEnd,
      fee_amount: totalAmount,
      fee_status:
        paidAmount >= totalAmount
          ? "paid"
          : paidAmount > 0
          ? "pending"
          : "overdue",
    });

    // 🗂️ Add to membership history
    await MembershipHistory.create({
      member: newMember._id,
      gym: adminGym._id,
      plan: gymPlan.planId._id,
      membership_start: membershipStart,
      membership_end: membershipEnd,
      status: "active",
    });

    // 💰 Fees collection
    const pendingAmount = totalAmount - paidAmount;
    await feesCollectionModel.create({
      member: newMember._id,
      gym: adminGym._id,
      planName: gymPlan.planId.name,
      totalAmount,
      paidAmount,
      pendingAmount,
      startDate: membershipStart,
      endDate: membershipEnd,
      status: pendingAmount > 0 ? "pending" : "completed",
      payments: [
        {
          amount: paidAmount,
          date: new Date(),
          mode: paymentMode,
          remark: remark || "Initial payment",
        },
      ],
    });

    // ✅ Final Response
    return res.status(200).json({
      success: true,
      message: `✅ Member registered successfully with ${gymPlan.planId.name}`,
      data: {
        userId: newUserId, // 👈 added custom sequential userId
        dbUserId: newUser._id,
        memberId: newMember._id,
        gymId: adminGym._id,
        planName: gymPlan.planId.name,
        membership_start: membershipStart,
        membership_end: membershipEnd,
        totalAmount,
        paidAmount,
        pendingAmount,
        feeStatus: newMember.fee_status,
      },
    });
  } catch (err) {
    console.error("❌ Member Registration Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: err.message,
    });
  }
};







export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const tempUser = req.app.locals.tempOtpStore?.[email];
    if (!tempUser) {
      return res.status(400).json({
        success: false,
        message: "No OTP request found. Please register first.",
      });
    }

    // Generate new OTP
    const newOtp = generateOtp();
    const newExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Update temp store
    req.app.locals.tempOtpStore[email] = {
      ...tempUser,
      otp: newOtp,
      expiry: newExpiry,
    };

    // Send OTP email
    await sendOtpEmail(email, newOtp);

    return res.json({
      success: true,
      message: "New OTP sent. Valid for 5 minutes.",
      otpExpiry: newExpiry,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};






export const registerTrainer = async (req, res) => {
  try {
    const gymId = req.user?.id || null; // agar available nahi to null
    const { name, email, phone, password, specialization, experience, bio, photo, userRole } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, Email and Password are required" });
    }

    // ✅ Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    // ✅ Create User (plain password)
    const newUser = await User.create({
      name,
      email,
      phone,
      password,
      userRole,
      status: "active",
    });

    // ✅ Create Trainer linked to User
    const newTrainer = await Trainer.create({
      user: newUser._id,
      specialization: specialization || [],
      experience: experience || 0,
      bio: bio || "",
      photo: photo || "",
      gyms: gymId ? [gymId] : [], // agar gymId hai to array me add, nahi to empty array
    });

    res.status(201).json({
      success: true,
      message: "Trainer registered successfully",
      data: { user: newUser, trainer: newTrainer },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};
