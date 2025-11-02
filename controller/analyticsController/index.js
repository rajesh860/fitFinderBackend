import Gym from "../../models/gym.model.js";
import Member from "../../models/member.model.js";
import MonthlyGymAnalytics from "../../models/MonthlyGymAnalytic.model.js";
import User from "../../models/user.model.js";

export const generateMonthlyAnalytics = async () => {
  try {
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Get all gyms
    const gyms = await Gym.find({});

    for (let gym of gyms) {
      // ✅ Users active last month
      const lastMonthUsers = await Member.find({
        $or: [
          {
            "currentGym.gym": gym._id,
            "currentGym.membership_start": { $lte: lastMonthEnd },
            "currentGym.membership_end": { $gte: lastMonthStart },
          },
          {
            "gymHistory.gym": gym._id,
            "gymHistory.membership_start": { $lte: lastMonthEnd },
            "gymHistory.membership_end": { $gte: lastMonthStart },
          },
        ],
      });

      // ✅ Users active this month
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const currentMonthUsers = await Member.find({
        $or: [
          {
            "currentGym.gym": gym._id,
            "currentGym.membership_start": { $lte: currentMonthEnd },
            "currentGym.membership_end": { $gte: currentMonthStart },
          },
          {
            "gymHistory.gym": gym._id,
            "gymHistory.membership_start": { $lte: currentMonthEnd },
            "gymHistory.membership_end": { $gte: currentMonthStart },
          },
        ],
      });

      // ✅ New / Lost Users
      const lastUserIds = lastMonthUsers.map((u) => u._id.toString());
      const currentUserIds = currentMonthUsers.map((u) => u._id.toString());

      const newUsersCount = currentUserIds.filter((id) => !lastUserIds.includes(id)).length;
      const lostUsersCount = lastUserIds.filter((id) => !currentUserIds.includes(id)).length;

      // ✅ Plan Popularity (Current Month)
      const planAggregation = await Member.aggregate([
        {
          $match: {
            "currentGym.gym": gym._id,
            "currentGym.status": "active",
          },
        },
        {
          $group: { _id: "$currentGym.plan", count: { $sum: 1 } },
        },
      ]);

      // ✅ Save monthly snapshot
      await MonthlyGymAnalytics.create({
        gymId: gym._id,
        month: lastMonthStart,
        activeUsersCount: lastMonthUsers.length,
        newUsersCount,
        lostUsersCount,
        planStats: planAggregation.map((p) => ({ planId: p._id, count: p.count })),
      });

      console.log(`✅ Analytics snapshot saved for Gym: ${gym.gymName}`);
    }
  } catch (err) {
    console.error("❌ Error generating monthly analytics:", err);
  }
};




