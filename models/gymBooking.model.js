import mongoose from "mongoose";

const GymBookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  gym: { type: mongoose.Schema.Types.ObjectId, ref: "Gym", required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" }, // optional
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  requestedAt: { type: Date, default: Date.now }
});
const GymBooking = mongoose.model("gymBooking", GymBookingSchema);
export default GymBooking