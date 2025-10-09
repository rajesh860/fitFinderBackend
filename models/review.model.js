import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema({
  gym: { type: mongoose.Schema.Types.ObjectId, ref: "Gym", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const ReviewModel = mongoose.model("review", ReviewSchema);
export default ReviewModel;