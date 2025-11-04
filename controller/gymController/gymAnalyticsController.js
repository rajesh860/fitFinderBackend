import mongoose from "mongoose";
import Member from "../../models/member.model.js";
import FeeCollection from "../../models/feesCollection.model.js";
import GymBooking from "../../models/gymBooking.model.js";
import Trainer from "../../models/trainer.model.js";

export const getGymDashboardController = async (req, res) => {
  try {
    const { gymId } = req.params;
    const { memberId } = req.query; // Optional: specific member check

    if (!mongoose.Types.ObjectId.isValid(gymId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid gymId",
      });
    }

    const gymObjectId = new mongoose.Types.ObjectId(gymId);
    const now = new Date();

    // ✅ 1. Calculate Total Gym Collection (All Time Revenue)
    const totalCollectionResult = await FeeCollection.aggregate([
      { 
        $match: { 
          gym: gymObjectId 
        } 
      },
      { $unwind: "$payments" },
      {
        $group: {
          _id: null,
          totalCollection: { $sum: "$payments.amount" }
        }
      }
    ]);

    const totalCollection = totalCollectionResult[0]?.totalCollection || 0;

    // ✅ 2. Current Month Revenue
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthRevenueResult = await FeeCollection.aggregate([
      { 
        $match: { 
          gym: gymObjectId 
        } 
      },
      { $unwind: "$payments" },
      {
        $match: {
          "payments.date": {
            $gte: startOfThisMonth,
            $lte: now,
          },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$payments.amount" }
        }
      }
    ]);

    const thisMonthRevenue = thisMonthRevenueResult[0]?.revenue || 0;

    // ✅ 3. Today's Bookings
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    
    const todaysBookings = await GymBooking.countDocuments({
      gym: gymObjectId,
      requestedAt: { $gte: todayStart, $lte: todayEnd },
    });

    // ✅ 4. Active Members Count
    const activeMembers = await Member.countDocuments({
      "currentGym.gym": gymObjectId,
      "currentGym.membership_end": { $gte: now },
      "currentGym.status": "active"
    });

    // ✅ 5. Active Trainers Count
    const activeTrainers = await Trainer.countDocuments({
      gyms: gymObjectId,
      status: "active"
    });

    // ✅ 6. Last Month Revenue (for growth calculation)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const lastMonthRevenueResult = await FeeCollection.aggregate([
      { 
        $match: { 
          gym: gymObjectId 
        } 
      },
      { $unwind: "$payments" },
      {
        $match: {
          "payments.date": {
            $gte: startOfLastMonth,
            $lte: endOfLastMonth,
          },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$payments.amount" }
        }
      }
    ]);

    const lastMonthRevenue = lastMonthRevenueResult[0]?.revenue || 0;

    // ✅ 7. Last Month Active Members (for growth calculation)
    const lastMonthActiveMembers = await Member.countDocuments({
      "currentGym.gym": gymObjectId,
      "currentGym.membership_end": { $gte: endOfLastMonth },
      "currentGym.status": "active"
    });

    // ✅ 8. Yesterday's Bookings (for growth calculation)
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayEnd = new Date(todayEnd.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayBookings = await GymBooking.countDocuments({
      gym: gymObjectId,
      requestedAt: { $gte: yesterdayStart, $lte: yesterdayEnd },
    });

    // ✅ 9. Growth Calculations
    const calcGrowth = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const revenueGrowthPercent = calcGrowth(thisMonthRevenue, lastMonthRevenue);
    const memberGrowthPercent = calcGrowth(activeMembers, lastMonthActiveMembers);
    const bookingGrowthPercent = calcGrowth(todaysBookings, yesterdayBookings);

    // ✅ 10. Membership Plan Distribution
    const membershipDistribution = await Member.aggregate([
      {
        $match: {
          "currentGym.gym": gymObjectId,
          "currentGym.membership_end": { $gte: now },
          "currentGym.status": "active"
        }
      },
      {
        $lookup: {
          from: "plans",
          localField: "currentGym.plan",
          foreignField: "_id",
          as: "planInfo"
        }
      },
      {
        $unwind: { path: "$planInfo", preserveNullAndEmptyArrays: true }
      },
      {
        $group: {
          _id: "$planInfo.name",
          count: { $sum: 1 }
        }
      }
    ]);

    // ✅ 11. Revenue Trends (Last 6 Months)
    const revenueTrends = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthRevenueResult = await FeeCollection.aggregate([
        { $match: { gym: gymObjectId } },
        { $unwind: "$payments" },
        {
          $match: {
            "payments.date": {
              $gte: monthStart,
              $lte: monthEnd,
            },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$payments.amount" }
          }
        }
      ]);

      revenueTrends.push({
        month: monthStart.toISOString().substring(0, 7), // "2024-01"
        revenue: monthRevenueResult[0]?.revenue || 0
      });
    }

    // ✅ 12. Optional: Check Specific Member Plan Status
    let memberPlanStatus = null;
    if (memberId && mongoose.Types.ObjectId.isValid(memberId)) {
      const memberObjectId = new mongoose.Types.ObjectId(memberId);
      
      const member = await Member.findOne({
        _id: memberObjectId,
        "currentGym.gym": gymObjectId
      }).populate('user', 'name email').populate('currentGym.plan', 'name duration price');

      if (member) {
        const membershipEnd = new Date(member.currentGym.membership_end);
        const isExpired = membershipEnd < now;
        const daysRemaining = Math.ceil((membershipEnd - now) / (1000 * 60 * 60 * 24));

        const feeCollection = await FeeCollection.findOne({
          member: memberObjectId,
          gym: gymObjectId
        }).sort({ createdAt: -1 });

        let expiryStatus = "";
        let reasons = [];

        if (!isExpired) {
          expiryStatus = "ACTIVE";
          reasons.push(`Plan valid until ${membershipEnd.toLocaleDateString()}`);
          reasons.push(`${daysRemaining} days remaining`);
          
          if (feeCollection) {
            if (feeCollection.status === "pending") {
              reasons.push("Payment status: PENDING");
            }
            if (feeCollection.pendingAmount > 0) {
              reasons.push(`Pending payment: ₹${feeCollection.pendingAmount}`);
            }
          }
        } else {
          expiryStatus = "EXPIRED";
          reasons.push(`Plan expired on ${membershipEnd.toLocaleDateString()}`);
          reasons.push(`Expired ${Math.abs(daysRemaining)} days ago`);
        }

        memberPlanStatus = {
          memberId: member._id,
          memberName: member.user?.name || "N/A",
          planName: member.currentGym.plan?.name || "N/A",
          membershipEnd: member.currentGym.membership_end,
          expiryStatus,
          isExpired,
          daysRemaining: isExpired ? -Math.abs(daysRemaining) : daysRemaining,
          reasons,
          pendingAmount: feeCollection?.pendingAmount || 0
        };
      }
    }

    // ✅ Final Response - GymId ke base pe saara data
    res.json({
      success: true,
      data: {
        // Main Summary (Aapke screenshot jaisa)
        summary: {
          totalMembers: activeMembers,
          activeTrainers: activeTrainers,
          monthlyRevenue: thisMonthRevenue,
          todaysBookings: todaysBookings,
        },
        // Growth Percentages
        growth: {
          revenueGrowthPercent: revenueGrowthPercent,
          memberGrowthPercent: memberGrowthPercent,
          bookingGrowthPercent: bookingGrowthPercent,
        },
        // Financial Information
        financials: {
          totalCollection: totalCollection, // Total abhi tak ka collection
          thisMonthRevenue: thisMonthRevenue,
          lastMonthRevenue: lastMonthRevenue,
        },
        // Revenue Trends (Last 6 Months)
        revenueTrends: revenueTrends,
        // Membership Distribution
        membershipDistribution: membershipDistribution.map(item => ({
          planName: item._id || "Unknown",
          count: item.count
        })),
        // Member Plan Status (Only if memberId diya hai)
        memberPlanStatus: memberPlanStatus,
        // Additional Info
        timestamp: now.toISOString(),
        gymId: gymId
      }
    });

  } catch (err) {
    console.error("Error in gym dashboard:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};