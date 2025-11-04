import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema({
  amount: Number,
  date: { type: Date, default: Date.now },
  mode: {
    type: String,
    enum: ["cash", "upi", "card", "bank"],
    default: "cash",
  },
  remark: String,
});

const FeeCollectionSchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: "Member" },
  gym: { type: mongoose.Schema.Types.ObjectId, ref: "Gym" },
  planName: String,
  totalAmount: Number,
  paidAmount: { type: Number, default: 0 },
  pendingAmount: { type: Number, default: 0 },
  startDate: Date,
  endDate: Date,
  status: {
    type: String,
    enum: ["active", "completed", "pending"],
    default: "pending",
  },
  payments: [PaymentSchema],
},{ timestamps: true });

export default mongoose.model("FeeCollection", FeeCollectionSchema);
