import mongoose from "mongoose";

const TrainerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  gyms: [{ type: mongoose.Schema.Types.ObjectId, ref: "Gym" }], // Gym join kiye
  specialization: [String], // e.g., Yoga, Strength, Cardio
  experience: Number, // years
  bio: String,
  photo: String,
  rating: { type: Number, default: 0 },

  // createdBy: { type: String, enum: ["trainer", "owner"], default: "trainer" },
}, { timestamps: true });

const Trainer=  mongoose.model("Trainer", TrainerSchema);
export default Trainer;
