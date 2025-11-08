import mongoose from "mongoose";

// Payment sub-schema


// Current plan sub-schema
const CurrentPlanSchema = new mongoose.Schema({
  planName: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  pendingAmount: { type: Number, default: 0 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ["active", "completed", "pending", "expired"],
    default: "pending",
  },
   mode: {
    type: String,
    enum: ["cash", "upi", "card", "bank"],
    default: "cash",
  },
 remark: String,
},{ timestamps: true });

// Main FeeCollection schema
const FeeCollectionSchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  gym: { type: mongoose.Schema.Types.ObjectId, ref: "Gym", required: true },
  current: CurrentPlanSchema,        // current plan info
  payments: [CurrentPlanSchema],         // all payments
}, { timestamps: true });

export default mongoose.model("FeeCollection", FeeCollectionSchema);
