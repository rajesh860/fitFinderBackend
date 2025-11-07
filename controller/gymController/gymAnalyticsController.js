import mongoose from "mongoose";
import Member from "../../models/member.model.js";
import FeeCollection from "../../models/feesCollection.model.js";
import GymBooking from "../../models/gymBooking.model.js";
import Trainer from "../../models/trainer.model.js";
import Gym from "../../models/gym.model.js";

export const getGymDashboardController = async (req, res) => {
  try {
    const id = req.user.id;
    const findGym = await Gym.findOne({ user: id });
    const gymId = findGym?._id;

    if (!mongoose.Types.ObjectId.isValid(gymId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid gymId",
      });
    }

    const gymObjectId = new mongoose.Types.ObjectId(gymId);
    const now = new Date();

    // 🔹 Month Ranges
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // 🔹 Step 1: Get all members whose currentGym.gym matches
    const activeMembers = await Member.find(
      { "currentGym.gym": gymObjectId },
      { _id: 1 }
    ).lean();

    const memberIds = activeMembers.map((m) => m._id);

    // 🧾 Step 2: Calculate This Month Summary
    const thisMonthSummary = await FeeCollection.aggregate([
      { $match: { member: { $in: memberIds } } },
      { $unwind: "$payments" },
      {
        $match: {
          "payments.date": { $gte: startOfThisMonth, $lte: endOfThisMonth },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$totalAmount" },
          paidAmount: { $sum: "$payments.amount" },
          pendingAmount: { $sum: "$pendingAmount" },
        },
      },
    ]);

    // 🧾 Step 3: Last Month Summary
    const lastMonthSummary = await FeeCollection.aggregate([
      { $match: { member: { $in: memberIds } } },
      { $unwind: "$payments" },
      {
        $match: {
          "payments.date": { $gte: startOfLastMonth, $lte: endOfLastMonth },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$totalAmount" },
          paidAmount: { $sum: "$payments.amount" },
          pendingAmount: { $sum: "$pendingAmount" },
        },
      },
    ]);

    // 🧾 Step 4: Lifetime Total
    const totalCollectionSummary = await FeeCollection.aggregate([
      { $match: { member: { $in: memberIds } } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$totalAmount" },
          paidAmount: { $sum: "$paidAmount" },
          pendingAmount: { $sum: "$pendingAmount" },
        },
      },
    ]);

    const thisMonth =
      thisMonthSummary[0] || { totalAmount: 0, paidAmount: 0, pendingAmount: 0 };
    const lastMonth =
      lastMonthSummary[0] || { totalAmount: 0, paidAmount: 0, pendingAmount: 0 };
    const totalCollection =
      totalCollectionSummary[0] || { totalAmount: 0, paidAmount: 0, pendingAmount: 0 };

    // 📈 Growth %
    const growthPercent =
      lastMonth.paidAmount === 0
        ? thisMonth.paidAmount > 0
          ? 100
          : 0
        : Math.round(
            ((thisMonth.paidAmount - lastMonth.paidAmount) /
              lastMonth.paidAmount) *
              100
          );

    // 👥 Members
    const totalMembers = activeMembers.length;
    const lastMonthMembers = await Member.countDocuments({
      "currentGym.gym": gymObjectId,
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    });

    const memberGrowth =
      lastMonthMembers === 0
        ? totalMembers > 0
          ? 100
          : 0
        : Math.round(((totalMembers - lastMonthMembers) / lastMonthMembers) * 100);

    // 🧑‍🏫 Trainers
    const totalTrainers = await Trainer.countDocuments({
      gyms: gymObjectId,
    });

    const lastMonthTrainers = await Trainer.countDocuments({
      gyms: gymObjectId,
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    });

    const trainerGrowth =
      lastMonthTrainers === 0
        ? totalTrainers > 0
          ? 100
          : 0
        : Math.round(((totalTrainers - lastMonthTrainers) / lastMonthTrainers) * 100);

    // 💰 Step 5: All Plans Summary (only active members’ plans)
    const plansStats = await FeeCollection.aggregate([
      { $match: { member: { $in: memberIds } } },
      {
        $group: {
          _id: "$planName",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$paidAmount" },
        },
      },
      { $sort: { count: -1, totalRevenue: -1 } },
    ]);

    const topSellingPlan = plansStats.length
      ? {
          name: plansStats[0]._id,
          soldCount: plansStats[0].count,
          revenue: plansStats[0].totalRevenue,
        }
      : null;

    // 📊 Step 6: Last 12 Months Revenue Trend
    const startOfYear = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const monthlyRevenue = await FeeCollection.aggregate([
      { $match: { member: { $in: memberIds } } },
      { $unwind: "$payments" },
      { $match: { "payments.date": { $gte: startOfYear, $lte: now } } },
      {
        $group: {
          _id: {
            year: { $year: "$payments.date" },
            month: { $month: "$payments.date" },
          },
          totalPaid: { $sum: "$payments.amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Convert to 12-month labeled data
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const monthlyStats = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const found = monthlyRevenue.find(
        (m) => m._id.year === date.getFullYear() && m._id.month === date.getMonth() + 1
      );
      return {
        month: monthNames[date.getMonth()],
        revenue: found ? found.totalPaid : 0,
      };
    });

    // ✅ Final Response
    res.json({
      success: true,
      data: {
        gymId,
        totalCollection: totalCollection.paidAmount,
        lastMonth: lastMonth.paidAmount,
        growthPercent,
        totalMembers,
        lastMonthMembers,
        memberGrowthPercent: memberGrowth,
        totalTrainers,
        lastMonthTrainers,
        trainerGrowthPercent: trainerGrowth,
        plansStats,
        topSellingPlan,
        monthlyStats, // ✅ Added for chart
        message:
          growthPercent >= 0
            ? `Revenue increased by ${growthPercent}% compared to last month`
            : `Revenue decreased by ${Math.abs(growthPercent)}% compared to last month`,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching gym dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};