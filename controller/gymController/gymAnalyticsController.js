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

    // 🔹 Step 1: Get all fee collections for this gym
    const feeCollections = await FeeCollection.find({ 
      gym: gymObjectId 
    })
    .populate('member')
    .lean();

    if (!feeCollections.length)
      return res.status(404).json({ success: false, message: "No fee collections found" });

    // 🔹 Step 2: Calculate totals from CURRENT objects (consistent with getAllFeeCollections)
    let totalCollection = 0;
    let thisMonthPaid = 0;
    let lastMonthPaid = 0;

    feeCollections.forEach(fc => {
      const paidAmount = fc.current?.paidAmount || 0;
      totalCollection += paidAmount;

      // Check if current plan was created/updated this month
      if (fc.current?.createdAt) {
        const planDate = new Date(fc.current.createdAt);
        if (planDate >= startOfThisMonth && planDate <= endOfThisMonth) {
          thisMonthPaid += paidAmount;
        }
        if (planDate >= startOfLastMonth && planDate <= endOfLastMonth) {
          lastMonthPaid += paidAmount;
        }
      }
    });

    // 🔹 Step 3: Get members count
    const members = await Member.find({ "currentGym.gym": gymObjectId }).lean();
    const totalMembers = members.length;
    
    const lastMonthMembers = members.filter(
      (m) =>
        m.currentGym?.membership_start >= startOfLastMonth &&
        m.currentGym?.membership_start <= endOfLastMonth
    ).length;

    const memberGrowth =
      lastMonthMembers === 0
        ? totalMembers > 0
          ? 100
          : 0
        : Math.round(((totalMembers - lastMonthMembers) / lastMonthMembers) * 100);

    // 🧑‍🏫 Trainers
    const totalTrainers = await Trainer.countDocuments({ gyms: gymObjectId });
    const lastMonthTrainers = await Trainer.countDocuments({
      gyms: gymObjectId,
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    });

    const trainerGrowth =
      lastMonthTrainers === 0
        ? totalTrainers > 0
          ? 100
          : 0
        : Math.round(
            ((totalTrainers - lastMonthTrainers) / lastMonthTrainers) * 100
          );

    // 📈 Growth %
    const growthPercent =
      lastMonthPaid === 0
        ? thisMonthPaid > 0
          ? 100
          : 0
        : Math.round(((thisMonthPaid - lastMonthPaid) / lastMonthPaid) * 100);

    // 💰 Step 4: Plan-wise revenue (from current objects)
    const plansStats = await FeeCollection.aggregate([
      { $match: { gym: gymObjectId } },
      {
        $group: {
          _id: "$current.planName",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$current.paidAmount" },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    const topSellingPlan = plansStats.length
      ? {
          name: plansStats[0]._id,
          soldCount: plansStats[0].count,
          revenue: plansStats[0].totalRevenue,
        }
      : null;

    // 📊 Step 5: Generate last 12 months trend from CURRENT objects
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    const monthlyStats = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthlyRevenue = await FeeCollection.aggregate([
        { $match: { gym: gymObjectId } },
        {
          $match: {
            "current.createdAt": {
              $gte: startOfMonth,
              $lte: endOfMonth
            }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$current.paidAmount" }
          }
        }
      ]);

      monthlyStats.push({
        month: monthNames[date.getMonth()],
        revenue: monthlyRevenue[0]?.totalRevenue || 0,
      });
    }

    // ✅ Final Response
    res.json({
      success: true,
      data: {
        gymId,
        totalCollection,
        thisMonthCollection: thisMonthPaid,
        lastMonthCollection: lastMonthPaid,
        growthPercent,
        totalMembers,
        lastMonthMembers,
        memberGrowthPercent: memberGrowth,
        totalTrainers,
        lastMonthTrainers,
        trainerGrowthPercent: trainerGrowth,
        plansStats,
        topSellingPlan,
        monthlyStats,
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