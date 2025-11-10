import User from "../../models/user.model.js";
import Gym from "../../models/gym.model.js";
import Member from "../../models/member.model.js";
import Trainer from "../../models/trainer.model.js";
import FeeCollection from "../../models/feesCollection.model.js";
import Attendance from "../../models/attendence.model.js";
// import { Enquiry } from "../models/enquiry.model.js";

export const getAdminDashboardData = async (req, res) => {
  try {
    // --- Basic Stats ---
    const totalGyms = await Gym.countDocuments();
    const totalMembers = await Member.countDocuments();
    const totalTrainers = await Trainer.countDocuments();
    // const totalEnquiries = await Enquiry.countDocuments();

    // --- Total Revenue ---
    const allCollections = await FeeCollection.find();
    const totalRevenue = allCollections.reduce(
      (sum, fc) => sum + (fc.current?.paidAmount || 0),
      0
    );

    // --- Monthly Revenue (last 6 months) ---
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return { month: date.toLocaleString("default", { month: "short" }), year: date.getFullYear() };
    }).reverse();

    const monthlyRevenue = await Promise.all(
      last6Months.map(async ({ month, year }) => {
        const start = new Date(year, new Date(`${month} 1, ${year}`).getMonth(), 1);
        const end = new Date(year, new Date(`${month} 1, ${year}`).getMonth() + 1, 0);
        const monthRevenue = await FeeCollection.aggregate([
          { $match: { createdAt: { $gte: start, $lte: end } } },
          {
            $group: {
              _id: null,
              total: { $sum: "$current.paidAmount" },
            },
          },
        ]);
        return { month, total: monthRevenue[0]?.total || 0 };
      })
    );

    // --- Gym Performance ---
    const gyms = await Gym.find().limit(10); // limit for dashboard
    const gymPerformance = await Promise.all(
      gyms.map(async (gym) => {
        const activeMembers = await Member.countDocuments({
          "currentGym.gym": gym._id,
          "currentGym.status": "active",
        });

        const totalAttendance = await Attendance.countDocuments({ gym: gym._id });
        const presentAttendance = await Attendance.countDocuments({
          gym: gym._id,
          status: "present",
        });

        const attendanceRate =
          totalAttendance > 0 ? Math.round((presentAttendance / totalAttendance) * 100) : 0;

        const gymRevenueDocs = await FeeCollection.find({ gym: gym._id });
        const gymRevenue = gymRevenueDocs.reduce(
          (sum, fc) => sum + (fc.current?.paidAmount || 0),
          0
        );

        return {
          gymName: gym.gymName,
          activeMembers,
          attendanceRate,
          revenue: gymRevenue,
        };
      })
    );

    // --- Member Insights ---
    const activeMembersCount = await Member.countDocuments({ "currentGym.status": "active" });
    const inactiveMembersCount = await Member.countDocuments({
      "currentGym.status": { $in: ["expired", "removed"] },
    });

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const newMembersThisMonth = await Member.countDocuments({ createdAt: { $gte: startOfMonth } });

    // --- Biometric vs QR Attendance Ratio ---
    const totalAttendances = await Attendance.countDocuments();
    const biometricCount = await Attendance.countDocuments({ attendanceType: "Biometric" });
    const qrCount = await Attendance.countDocuments({ attendanceType: "QR" });

    const biometricUsage =
      totalAttendances > 0 ? Math.round((biometricCount / totalAttendances) * 100) : 0;

    // --- Recent Gyms & Members ---
    const recentGyms = await Gym.find().sort({ createdAt: -1 }).limit(5).select("gymName address createdAt");
    const recentMembers = await Member.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(5)
      .select("membership_start membership_end");

    // --- Final Response ---
    res.status(200).json({
      success: true,
      stats: {
        totalGyms,
        totalMembers,
        totalTrainers,
        totalRevenue,
        // totalEnquiries,
      },
      monthlyRevenue,
      gymPerformance,
      memberInsights: {
        active: activeMembersCount,
        inactive: inactiveMembersCount,
        newThisMonth: newMembersThisMonth,
        growthRate: "+12%", // optional dummy for UI
      },
      attendanceRatio: {
        biometric: biometricCount,
        qr: qrCount,
        biometricUsage,
        change: "+8%", // dummy UI stat
      },
      recentGyms,
      recentMembers,
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
