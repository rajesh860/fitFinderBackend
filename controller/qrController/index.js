import QRCode from "qrcode";
import dayjs from "dayjs";
import Gym from "../../models/gym.model.js";
import Attendance from "../../models/attendence.model.js";
import Member from "../../models/member.model.js";

// ✅ Generate QR for a Gym
export const generateGymQR = async (req, res) => {
  try {
    const gymId = req.user.id;

    const gym = await Gym.findOne({ user: gymId });
    console.log(gym, gymId);
    if (!gym)
      return res.status(404).json({ success: false, message: "Gym not found" });

    // QR content: Gym ID + secret
    const qrData = JSON.stringify({
      gymId: gym._id,
      secret: process.env.QR_SECRET || "fitme123",
    });

    // Generate QR
    const qrCodeURL = await QRCode.toDataURL(qrData);

    // ✅ Save QR to Gym document
    gym.branchQrCode = qrCodeURL;
    await gym.save();

    res.json({
      success: true,
      qrCodeURL,
      message: "QR generated and saved successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ✅ Scan QR & mark attendance
export const scanGymQR = async (req, res) => {
  try {
    const { qrData } = req.body; // QR se JSON milega
    const userId = req.user?.id; // Logged in user
    console.log(qrData, userId);
    if (!qrData)
      return res
        .status(400)
        .json({ success: false, message: "QR data missing" });

    const parsed = JSON.parse(qrData);

    if (parsed.secret !== (process.env.QR_SECRET || "fitme123"))
      return res.status(403).json({ success: false, message: "Invalid QR" });

    const gym = await Gym.findById(parsed.gymId);
    if (!gym)
      return res.status(404).json({ success: false, message: "Gym not found" });

    const member = await Member.findOne({
      user: userId,
      "currentGym.gym": gym._id,
    });
    if (!member)
      return res
        .status(403)
        .json({ success: false, message: "You are not a member of this gym" });

    const today = dayjs().startOf("day").toDate();

    const existing = await Attendance.findOne({
      member: member._id,
      gym: gym._id,
      date: today,
    });

    if (existing)
      return res.json({ success: true, message: "Attendance already marked" });

    await Attendance.create({
      member: member._id,
      gym: gym._id,
      date: today,
      status: "present",
    });

    res.json({ success: true, message: "✅ Attendance marked successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
