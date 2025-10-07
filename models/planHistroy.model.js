import mongoose from "mongoose";

const MembershipHistorySchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  gym: { type: mongoose.Schema.Types.ObjectId, ref: "Gym", required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
  membership_start: { type: Date, required: true },
  membership_end: { type: Date },
  status: { type: String, enum: ["active", "expired"], required: true },
  purchasedAt: { type: Date, default: Date.now } // record creation time
});

const MembershipHistory = mongoose.model("MembershipHistory", MembershipHistorySchema);
export default MembershipHistory;