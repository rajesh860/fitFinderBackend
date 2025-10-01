import dayjs from "dayjs";
import Attendance from "../../models/attendence.model.js";
import Gym from "../../models/gym.model.js";
import Member from "../../models/member.model.js";

export const markAttendance = async (req, res) => {
  try {
    const { gymId } = req.body;
    const memberId = req.user.id;

    if (!gymId) {
      return res.status(400).json({ message: "Gym ID is required" });
    }

    // ✅ Fetch Member with currentGym
    const member = await Member.findOne({ user: memberId }).select(
      "currentGym user"
    );

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    // ✅ Ensure the gym matches user's current gym
    if (
      !member.currentGym ||
      member.currentGym.toString() !== gymId.toString()
    ) {
      return res.status(403).json({
        message: "You can only mark attendance for your current gym.",
      });
    }

    // ✅ Verify gym exists (optional, since currentGym is valid)
    const gym = await Gym.findById(gymId);
    if (!gym) {
      return res.status(404).json({ message: "Gym not found" });
    }
    // ✅ Prevent duplicate attendance for same day
    const todayStart = dayjs().startOf("day").toDate();
    const todayEnd = dayjs().endOf("day").toDate();

    const existingAttendance = await Attendance.findOne({
      member: member.user, // Member’s ObjectId
      gym: gymId,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    if (existingAttendance) {
      return res
        .status(400)
        .json({ message: "Attendance already marked for today" });
    }

    // ✅ Create attendance
    const attendance = await Attendance.create({
      member: member.user,
      gym: gymId,
      date: new Date(),
      status: "present",
    });

    res.status(201).json({
      message: "Attendance marked successfully",
      attendance,
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
