import User from "../../models/user.model.js";
import Admin from "../../models/admin.model.js";
import Gym from "../../models/gym.model.js";
import Member from "../../models/member.model.js";
import { generateOtp, sendOtpEmail } from "../otpService.js";
import { GymPlan } from "../../models/planSchema.js";
import dayjs from "dayjs";
import MembershipHistory from "../../models/planHistroy.model.js";
import feesCollectionModel from "../../models/feesCollection.model.js";

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
    const expiry = Date.now() + 1 * 60 * 1000; // 5 minutes

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

    // 🧠 Create user object
    const userData = {
      name: tempUser.name,
      email: tempUser.email,
      phone: tempUser.phone,
      password: tempUser.password, // ⚠️ hash this before saving (bcrypt)
      userRole: tempUser.userRole,
    };

    // 🏋️ If user is gym, set status = pending
    if (tempUser.userRole === "gym") {
      userData.status = "pending"; // 👈 default pending until approved
    }

    // 💾 Save User in DB
    const user = new User(userData);
    await user.save();

    // 🧩 Role-based profile creation
    if (tempUser.userRole === "gym") {
      // ✅ use gymName from tempUser, not name
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
        message:
          "Your registration request has been submitted successfully. Your account will be activated within 4 hours as per our rules and guidelines.",
      });
    }

    // ✅ Default success message for other roles
    return res.json({
      success: true,
      message: "Registration successful",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const userRegistorByAdmin = async (req, res) => {
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
      isManual, // ✅ frontend se true/false
      manualStartDate, // optional
      manualEndDate,   // optional
    } = req.body;

    const adminId = req.user.id;

    const adminGym = await Gym.findOne({ user: adminId });
    if (!adminGym) {
      return res.status(404).json({
        success: false,
        message: "Admin gym not found. Please create gym first.",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered" });
    }

    const newUser = await User.create({
      name,
      email,
      phone,
      password,
      userRole,
      isVerified: true,
    });

    const gymPlan = await GymPlan.findById(planId).populate(
      "planId",
      "name durationInMonths"
    );
    if (!gymPlan) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid plan selected" });
    }

    // ✅ Membership Dates
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

    await MembershipHistory.create({
      member: newMember._id,
      gym: adminGym._id,
      plan: gymPlan.planId._id,
      membership_start: membershipStart,
      membership_end: membershipEnd,
      status: "active",
    });

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

    return res.status(200).json({
      success: true,
      message: `✅ Member registered successfully with ${gymPlan.planId.name}`,
      data: {
        userId: newUser._id,
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
    const newExpiry = Date.now() + 1 * 60 * 1000; // 5 minutes

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
