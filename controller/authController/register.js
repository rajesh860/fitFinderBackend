import User from "../../models/user.model.js";
import Admin from "../../models/admin.model.js";
import Gym from "../../models/gym.model.js";
import Member from "../../models/member.model.js";
import {generateOtp, sendOtpEmail} from "../otpService.js"




export const requestOtp = async (req, res) => {
  try {
    const { name, email, phone, password, userRole } = req.body;

    console.log(req.body, "Incoming OTP Request");

    // 🔒 Admin check: only one admin allowed
    if (userRole === "admin") {
      const adminExist = await User.findOne({ userRole: "admin" });
      if (adminExist) {
        return res.status(400).json({ 
          success: false, 
          message: "Admin account already exists. Cannot create another." 
        });
      }
    }

    // 🔍 Email existence check (for gym, member, admin)
    const exist = await User.findOne({ email });
    if (exist) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    // 🔢 Generate OTP
    const otp = generateOtp();
    const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes

    // 🧠 Store OTP and user data in temporary memory
    req.app.locals.tempOtpStore = req.app.locals.tempOtpStore || {};
    req.app.locals.tempOtpStore[email] = { name, email, phone, password, userRole, otp, expiry };

    // ✉️ Send OTP email
    await sendOtpEmail(email, otp);

    // ✅ Send response with OTP expiry info
    return res.json({ 
      success: true, 
      message: "OTP sent to email. Valid for 5 minutes.", 
      otpExpiry: expiry 
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
      return res.status(400).json({ success: false, message: "No OTP request found" });
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
      await new Gym({ user: user._id }).save();
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


