import Gym from "../../models/gym.model.js";
import User from "../../models/user.model.js";

export const registerGym = async (req, res) => {
  try {
    const { name, email, phone, password, gymName, address } = req.body;

    if (!name || !email || !password || !gymName) {
      return res
        .status(400)
        .json({ success: false, message: "All required fields are missing." });
    }

    // 🔍 Check if email already exists
    const exist = await User.findOne({ email });
    if (exist) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered." });
    }

    // 🧂 Hash password
    // const hashedPassword = await bcrypt.hash(password, 10);

    // 🔢 Generate incremental userId
    const lastUser = await User.findOne().sort({ userId: -1 }).select("userId");
    const newUserId =
      lastUser && lastUser.userId ? Number(lastUser.userId) + 1 : 100;

    // 🧠 Create new User
    const newUser = new User({
      userId: newUserId,
      name,
      email,
      phone,
      password: password,
      userRole: "gym",
      status: "pending", // ✅ Gym accounts will be verified manually
    });
    await newUser.save();

    // 🏋️ Create linked Gym record
    const newGym = new Gym({
      user: newUser._id,
      gymName,
      address: address || "",
      contact: phone || "",
      aboutGym: "",
      location: {
        type: "Point",
        coordinates: [0, 0],
      },
    });
    await newGym.save();

    // ✅ Return success
    return res.status(201).json({
      success: true,
      message:
        "Gym registration successful! Your account is pending admin approval.",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        userRole: newUser.userRole,
        gymId: newGym._id,
        gymName: newGym.gymName,
      },
    });
  } catch (err) {
    console.error("Error in registerGym:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};