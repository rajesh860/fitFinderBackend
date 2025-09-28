import mongoose from "mongoose";

const PlanSchema = new mongoose.Schema({
 name: { 
    type: String, 
    enum: ["BASIC", "SILVER", "GOLD", "PLATINUM"], 
    required: true ,
      unique: true, // 🚀 ensures DB level uniqueness
  },
  created_at: { type: Date, default: Date.now }
});

export const Plan = mongoose.model("Plan", PlanSchema);

const GymPlanSchema = new mongoose.Schema({
  gymId: { type: mongoose.Schema.Types.ObjectId, ref: "Gym", required: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
  price: { type: Number, required: true },      // Gym ka apna amount
  durationInMonths: { type: String, required: true }, // Gym ka apna duration
  features: [{ type: String }], // optional: agar owner custom features add karna chahe
  created_at: { type: Date, default: Date.now }
});
export const GymPlan = mongoose.model("GymPlan", GymPlanSchema);

