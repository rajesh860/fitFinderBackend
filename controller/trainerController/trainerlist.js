import { getPresignedUrl } from "../../middleware/presigned.js";
import Trainer from "../../models/trainer.model.js";
import TrainerReview from "../../models/trainerReview.js";

export const trainerList  = async (req, res) => {
  try {
    // 👇 Assume gym id is passed as query OR get from logged-in user
    const gymId = req.user.id;

    if (!gymId) {
      return res.status(400).json({ success: false, message: "Gym ID is required" });
    }

    // Fetch trainers who belong to this gym
    const trainers = await Trainer.find({ gyms: gymId })
      .populate("user", "name email phone")
      .populate("gyms", "name location");

    if (!trainers.length) {
      return res.status(404).json({ success: false, message: "No trainers found" });
    }

    res.json({ success: true, data: trainers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
}
export const getAllTrainerList = async (req, res) => {
  try {
    // 🧩 Fetch trainers and populate user name
    const trainers = await Trainer.find()
      .populate("user", "name")
      .select("bio photo user"); // only fetch necessary fields

    if (!trainers.length) {
      return res.status(404).json({
        success: false,
        message: "No trainers found",
      });
    }

    // 🧮 Process each trainer
    const trainerList = await Promise.all(
      trainers.map(async (trainer) => {
        // 🖼️ Generate presigned image
        let photoUrl = null;
        if (trainer.photo && trainer.photo.length > 0) {
          photoUrl = await getPresignedUrl(trainer.photo[0]);
        }

        // ⭐ Calculate rating info
        const reviews = await TrainerReview.find({ trainer: trainer._id });
        const totalRatings = reviews.reduce(
          (sum, review) => sum + (review.rating || 0),
          0
        );
        const averageRating =
          reviews.length > 0
            ? (totalRatings / reviews.length).toFixed(1)
            : 0;

        return {
          _id: trainer._id,
          name: trainer.user?.name || "Unknown",
          bio: trainer.bio || "",
          photo: photoUrl,
          averageRating: Number(averageRating),
          totalReviews: reviews.length,
        };
      })
    );

    // ✅ Send final response
    res.status(200).json({
      success: true,
      data: trainerList,
    });
  } catch (err) {
    console.error("Error fetching trainer list:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching trainers",
      error: err.message,
    });
  }
};


export const getTrainerProfile = async (req, res) => {
  try {
    const { id } = req.user;
    console.log(req.file, "hit");

    const trainer = await Trainer.findOne({ user: id })
      .populate("user", "name email phone")
      .populate("gyms", "name location");

    if (!trainer) {
      return res.status(404).json({ success: false, message: "Trainer not found" });
    }

    // Handle photo safely (string or array)
    let photo = null;

    if (Array.isArray(trainer.photo)) {
      photo = await Promise.all(trainer.photo.map((img) => getPresignedUrl(img)));
    } else if (typeof trainer.photo === "string" && trainer.photo.trim() !== "") {
      photo = await getPresignedUrl(trainer.photo);
    }
console.log(photo)
console.log(trainer.photo)
    res.json({
      success: true,
      data: {
        ...trainer.toObject(),
        photo:photo[0],
      },
    });
  } catch (error) {
    console.error("Error fetching trainer profile:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
