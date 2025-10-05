import User from "../../models/user.model.js";
import Admin from "../../models/admin.model.js";
import Gym from "../../models/gym.model.js";
import Member from "../../models/member.model.js";
import { generateOtp, sendOtpEmail } from "../otpService.js";
import { GymPlan } from "../../models/planSchema.js";

export const requestOtp = async (req, res) => {
  try {
    const { name, email, phone, password, userRole, gymName } = req.body;
    // 🔒 Admin check: only one admin allowed
    if (userRole === "admin") {
      const adminExist = await User.findOne({ userRole: "admin" });
      if (adminExist) {
        return res.status(400).json({
          success: false,
          message: "Admin account already exists. Cannot create another.",
        });
      }
    }

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
    const { name, email, phone, password, userRole, planId } = req.body;
    const adminId = req.user.id; // 🧠 Assume admin login se aa raha hai
    // 🔍 1️⃣ Get Admin's Gym
    const adminGym = await Gym.findOne({ user: adminId });
    if (!adminGym) {
      return res.status(400).json({
        success: false,
        message: "Admin gym not found. Please create gym first.",
      });
    }

    // 🔍 2️⃣ Validate Plan
    const selectedPlan = await GymPlan.findById(planId).populate("planId");
    if (!selectedPlan) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan selected.",
      });
    }

    // 🔒 3️⃣ Only one Admin allowed globally (if needed)
    if (userRole === "admin") {
      const adminExist = await User.findOne({ userRole: "admin" });
      if (adminExist) {
        return res.status(400).json({
          success: false,
          message: "Admin account already exists. Cannot create another.",
        });
      }
    }

    // 🔍 4️⃣ Email existence check
    const exist = await User.findOne({ email });
    if (exist) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered" });
    }

    // 💾 5️⃣ Create User
    const newUser = await new User({
      name,
      email,
      phone,
      password, // 👈 Plain password (testing purpose)
      userRole,
      isVerified: true,
    }).save();

    // 💾 6️⃣ Create Member profile linked to Gym & Plan
    const membershipStart = new Date();
    const membershipEnd = new Date();
    membershipEnd.setMonth(membershipEnd.getMonth() + Number(selectedPlan.durationInMonths));

    const newMember = await new Member({
      user: newUser._id,
      currentGym: {
        gym: adminGym._id,
        plan: selectedPlan.planId._id,
        membership_start: membershipStart,
        membership_end: membershipEnd,
        status: "active",
      },
      membership_start: membershipStart,
      membership_end: membershipEnd,
      fee_amount: selectedPlan.price,
      fee_status: "paid",
    }).save();

    return res.json({
      success: true,
      message: "User registered and added to gym successfully ✅",
      data: { user: newUser, member: newMember },
    });
  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
