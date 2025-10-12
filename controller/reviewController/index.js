import mongoose from "mongoose";
import ReviewModel from "../../models/review.model.js";
import Member from "../../models/member.model.js";



export const addOrUpdateReview = async (req, res) => {
  try {
    const userId = req.user.id; // authMiddleware se aayega
    const { gymId, rating, comment } = req.body;

    if (!gymId || !rating) {
      return res.status(400).json({
        success: false,
        message: "Gym ID and rating are required",
      });
    }

    // ✅ Check if user is a member of that gym
    const member = await Member.findOne({ user: userId, "currentGym.gym": gymId });

    if (!member) {
      return res.status(403).json({
        success: false,
        message: "You must be a member of this gym to give a review",
      });
    }

    // ✅ Check if review already exists
    let existingReview = await ReviewModel.findOne({ gym: gymId, user: userId });

    if (existingReview) {
      // Update review
      existingReview.rating = rating;
      existingReview.comment = comment || existingReview.comment;
      await existingReview.save();
    } else {
      // Create new review
      existingReview = await ReviewModel.create({
        gym: gymId,
        user: userId,
        rating,
        comment,
      });
    }

    // ✅ Calculate avg rating & total reviews
    const stats = await ReviewModel.aggregate([
      { $match: { gym: new mongoose.Types.ObjectId(gymId) } },
      {
        $group: {
          _id: "$gym",
          avgRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    const avgRating = stats.length > 0 ? stats[0].avgRating : 0;
    const totalReviews = stats.length > 0 ? stats[0].totalReviews : 0;

    res.status(200).json({
      success: true,
      message: "Review submitted successfully",
      data: {
        review: existingReview,
        avgRating,
        totalReviews,
      },
    });
  } catch (error) {
    console.error("Error adding review:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};



export const getReview = async (req,res)=>{
  try{
    const {gymId} = req.params
    if(!gymId){
      return res.status(400).json({
        success: false,
        message: "gym id required",
      });
    }
  const review = await ReviewModel.find({ gym:gymId }).populate("user" , "name");
    if(!review.length){
      return res.status(400).json({
        success: false,
        message: "review not found",
      });
    }
  res.status(200).json({
      success: true,
      message: "Review Found",
      data:review,
    });
  }catch(error) {
    console.error("Error adding review:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
}