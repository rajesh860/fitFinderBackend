import { getPresignedUrl } from "../../middleware/presigned.js";
import Gym from "../../models/gym.model.js";
import Trainer from "../../models/trainer.model.js";
import TrainerReview from "../../models/trainerReview.js";

export const trainerList = async (req, res) => {
  try {
    const loggedInUserId = req.user?.id;
    const paramGymId = req.params?.id;

    let gymExists = null;

    // 1️⃣ If gym ID passed in URL → /trainer-list/:id
    if (paramGymId) {
      gymExists = await Gym.findById(paramGymId).select("_id name location");
    }

    // 2️⃣ If logged-in user is gym owner
    if (!gymExists && loggedInUserId) {
      gymExists = await Gym.findOne({ user: loggedInUserId }).select(
        "_id name location"
      );
    }

    // 3️⃣ No gym found → return
    if (!gymExists) {
      return res.status(404).json({
        success: false,
        message: "Gym not found. Invalid gym ID or user is not linked to any gym.",
      });
    }

    // 4️⃣ Fetch trainers
    const trainers = await Trainer.find({ gyms: gymExists._id })
      .populate("user", "name email phone userId")
      .populate("gyms", "name location")
      .select(
        "specialization experience bio averageRating totalReviews photo gallery createdAt"
      );

    if (!trainers || trainers.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No trainers found for this gym.",
        data: [],
      });
    }

    // 5️⃣ Image Presigning
    const finalTrainers = await Promise.all(
      trainers.map(async (trainer) => {
        const formattedTrainer = trainer.toObject();

        // 📌 presign photo
        if (formattedTrainer.photo?.length > 0) {
          formattedTrainer.photo = await Promise.all(
            formattedTrainer.photo.map((img) => getPresignedUrl(img))
          );
        }

        // 📌 presign gallery images
        if (formattedTrainer.gallery?.length > 0) {
          formattedTrainer.gallery = await Promise.all(
            formattedTrainer.gallery.map((img) => getPresignedUrl(img))
          );
        }

        return formattedTrainer;
      })
    );

    // 6️⃣ Final response
    return res.status(200).json({
      success: true,
      count: finalTrainers.length,
      gym: gymExists,
      data: finalTrainers,
    });

  } catch (err) {
    console.error("Error in trainerList:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching trainers.",
      error: err.message,
    });
  }
};


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
    
    const trainer = await Trainer.findOne({ user: id })
    .populate("user", "name email phone")
    .populate("gyms", "gymName address");

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
