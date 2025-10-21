import jwt from "jsonwebtoken";
import User from "../../models/user.model.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // ✅ Convert email to lowercase before search
    const normalizedEmail = email.trim().toLowerCase();

    // ✅ Find user case-insensitively
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // ✅ Plain password check (should later be replaced by bcrypt)
    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // ✅ Restrict access for admin/gym
    if (user.userRole === "admin" || user.userRole === "gym") {
      return res.status(403).json({ message: "Access denied. You are not a member" });
    }

    // ✅ Generate JWT
    const token = jwt.sign(
      { id: user._id, userRole: user.userRole },
      process.env.SECRET_JWT,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        userId: user._id,
        name: user.name,
        email: user.email,
        userRole: user.userRole,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const normalizedEmail = email.trim().toLowerCase();

    // find user in User collection
    const user = await User.findOne({ email:normalizedEmail });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
 if(user.userRole === 'member'){
  return res.status(403).json({ message: "Access denied. Not an admin user." });
}

  // ✅ Plain password check
    if (user.password !== password) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

   

    // generate token
    const token = jwt.sign(
      { id: user._id, userRole: user.userRole },
      process.env.SECRET_JWT,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      success: true,
      token,
      user: {
        userId: user._id,
        name: user.name,
        email: user.email,
        userRole: user.userRole
      }
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};






export const demoLogin = async (req, res) => {
  try {
    // Fixed demo user credentials
    console.log("hit")
    const demoEmail = "demo@example.com";
    const demoUser = await User.findOne({ email: demoEmail }).select("-password");

    if (!demoUser) {
      return res.status(404).json({ success: false, message: "Demo user not found" });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: demoUser._id, email: demoUser.email },
      process.env.SECRET_JWT,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      message: "Demo login successful",
      user: demoUser,
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};