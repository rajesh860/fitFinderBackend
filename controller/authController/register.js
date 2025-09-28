import User from "../../models/user.model.js";
import Admin from "../../models/admin.model.js";
import Gym from "../../models/gym.model.js";
import Member from "../../models/member.model.js";
import {generateOtp, sendOtpEmail} from "../otpService.js"



// export const register = async (req, res) => {
//   try {
//     const { email, otp } = req.body;
//     const tempStore = req.app.locals.tempOtpStore || {};
//     const data = tempStore[email];

//     if (!data) return res.status(400).json({ success: false, message: "No OTP request found" });
//     if (data.expiry < Date.now()) return res.status(400).json({ success: false, message: "OTP expired" });
//     if (data.otp !== otp) return res.status(400).json({ success: false, message: "Invalid OTP" });

//     // ✅ OTP verified → actual register karo
//     const user = new User({
//       name: data.name,
//       email: data.email,
//       phone: data.phone,
//       password: data.password,
//       userRole: data.userRole,
//     });
//     await user.save();

//     if (data.userRole === "gym") {
//       await new Gym({ user: user._id }).save();
//     } else if (data.userRole === "member") {
//       await new Member({ user: user._id }).save();
//     } else if (data.userRole === "admin") {
//       await new Admin({ user: user._id }).save();
//     }

//     // clear temp store
//     delete tempStore[email];

//     return res.json({ success: true, message: "Registration successful after OTP verification", user });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };



export const requestOtp = async (req, res) => {
  try {
    const { name, email, phone, password, userRole } = req.body;

    console.log(req.body, "Incoming OTP Request");

    // Admin check
    if (userRole === "admin") {
      const adminExist = await User.findOne({ userRole: "admin" });
      if (adminExist) {
        return res.status(400).json({ 
          success: false, 
          message: "Admin account already exists. Cannot create another." 
        });
      }
    }

    // Check if email already registered
    const exist = await User.findOne({ email });
    if (exist) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    // Generate OTP
    const otp = generateOtp();
    const expiry = Date.now() + 5 * 60 * 1000; // 5 min in milliseconds

    // Store in temp collection
    req.app.locals.tempOtpStore = req.app.locals.tempOtpStore || {};
    req.app.locals.tempOtpStore[email] = { name, email, phone, password, userRole, otp, expiry };

    // Send OTP email
    await sendOtpEmail(email, otp);

    // Send response with expiry timestamp
    return res.json({ 
      success: true, 
      message: "OTP sent to email. Valid for 5 minutes.", 
      otpExpiry: expiry // frontend can use this to show countdown
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

    // create actual user in DB
    const user = new User({
      name: tempUser.name,
      email: tempUser.email,
      phone: tempUser.phone,
      password: tempUser.password, // hash karna mat bhoolna
      userRole: tempUser.userRole
    });
    await user.save();

    if (tempUser.userRole === "gym") {
      await new Gym({ user: user._id }).save();
    } else if (tempUser.userRole === "member") {
      await new Member({ user: user._id }).save();
    } else if (tempUser.userRole === "admin") {
      await new Admin({ user: user._id }).save();
    }

    // ✅ delete from temp store
    delete req.app.locals.tempOtpStore[email];
    res.json({ success: true, message: "Registration successful" });
  } catch (err) {
    console.log(err)
    res.status(500).json({ success: false, message: err.message });
  }
};
