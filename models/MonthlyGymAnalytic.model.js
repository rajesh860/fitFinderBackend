import mongoose from "mongoose";

const MonthlyGymAnalyticsSchema = new mongoose.Schema({
  gymId: { type: mongoose.Schema.Types.ObjectId, ref: "Gym", required: true },
  month: { type: Date, required: true }, // month start date
  activeUsersCount: { type: Number, default: 0 },
  newUsersCount: { type: Number, default: 0 },
  lostUsersCount: { type: Number, default: 0 },
  planStats: [
    {
      planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
      count: { type: Number, default: 0 },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

const  MonthlyGymAnalytics = mongoose.model(
  "MonthlyGymAnalytics",
  MonthlyGymAnalyticsSchema
);
export default MonthlyGymAnalytics

