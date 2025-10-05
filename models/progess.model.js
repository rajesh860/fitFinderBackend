import mongoose from "mongoose";

const MeasurementHistorySchema = new mongoose.Schema({
  weight: Number,
  height: Number,
  arm: Number,
  waist: Number,
  thigh: Number,
  chest: Number,
  bloodGroup: String,
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Gym" },
  updatedAt: { type: Date, default: Date.now },
});

const ProgressSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
  },
  gym: { type: mongoose.Schema.Types.ObjectId, ref: "Gym", required: true },

  current: {
    weight: Number,
    height: Number,
    arm: Number,
    waist: Number,
    thigh: Number,
    chest: Number,
    bloodGroup: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Gym" },
    updatedAt: { type: Date, default: Date.now },
  },

  history: [MeasurementHistorySchema],
});

const Progress = mongoose.model("Progress", ProgressSchema);
export default Progress;
