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

    if (!qrData)
      return res
        .status(400)
        .json({ success: false, message: "QR data missing" });

    // ✅ Parse & verify QR
    const parsed = JSON.parse(qrData);
    if (parsed.secret !== (process.env.QR_SECRET || "fitmeGym2025@Secure!"))
      return res.status(403).json({ success: false, message: "Invalid QR" });

    // ✅ Gym verify
    const gym = await Gym.findById(parsed.gymId);
    if (!gym)
      return res.status(404).json({ success: false, message: "Gym not found" });

    // ✅ Member verify (user + current gym match)
    const member = await Member.findOne({
      user: userId,
      "currentGym.gym": gym._id,
    });

    if (!member)
      return res
        .status(400)
        .json({ success: false, message: "You are not a member of this gym" });

    // ✅ Check membership plan validity
    const currentPlan = member.currentPlan; // ensure this field exists in your model
    const today = dayjs();

    if (
      !currentPlan ||
      !currentPlan.endDate ||
      dayjs(currentPlan.endDate).isBefore(today, "day")
    ) {
      return res.status(400).json({
        success: false,
        message: "Your membership has expired. Please renew your plan.",
      });
    }

    // ✅ Check if already marked today
    const todayDate = today.startOf("day").toDate();
    const existing = await Attendance.findOne({
      member: member._id,
      gym: gym._id,
      date: todayDate,
    });

    if (existing)
      return res.json({ success: true, message: "Attendance already marked" });

    // ✅ Mark attendance
    await Attendance.create({
      member: member._id,
      gym: gym._id,
      date: todayDate,
      status: "present",
    });

    res.json({ success: true, message: "✅ Attendance marked successfully" });
  } catch (err) {
    console.error("Error in scanGymQR:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
