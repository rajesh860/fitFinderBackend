import mongoose from "mongoose";

const GymHistorySchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  gym: { type: mongoose.Schema.Types.ObjectId, ref: "Gym", required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan",  },
  membership_start: { type: Date, required: true },
  membership_end: { type: Date, required: true },
  status: { type: String, enum: ["active", "expired"], default: "active" },
}, { timestamps: true });

export const GymHistory = mongoose.model("GymHistory", GymHistorySchema);
