import jwt from "jsonwebtoken";
// import bcrypt from "bcryptjs";
import User from "../../models/user.model.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // find user in User collection
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
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
