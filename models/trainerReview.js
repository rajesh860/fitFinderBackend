import mongoose from "mongoose";

const TrainerReviewSchema = new mongoose.Schema(
  {
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trainer",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    comment: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// 🛡️ Prevent same user reviewing the same trainer multiple times
TrainerReviewSchema.index({ trainer: 1, user: 1 }, { unique: true });

const TrainerReview = mongoose.model("TrainerReview", TrainerReviewSchema);
export default TrainerReview;
