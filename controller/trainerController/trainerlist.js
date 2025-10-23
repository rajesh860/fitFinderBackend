import { getPresignedUrl } from "../../middleware/presigned.js";
import Trainer from "../../models/trainer.model.js";

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
   

    const trainers = await Trainer.find()
      .populate("user", "name email phone")
      .populate("gyms", "name location");

    if (!trainers.length) {
      return res.status(404).json({ success: false, message: "No trainers found" });
    }

    // Generate presigned URLs for each trainer's photo
    const trainersWithPhotos = await Promise.all(
      trainers.map(async (trainer) => {
        let photoUrl = null;
        if (trainer.photo) {
          photoUrl = await getPresignedUrl(trainer.photo[0]); // assuming photo is single string
        }
        return {
          ...trainer.toObject(), // convert mongoose doc to plain object
          photo: photoUrl,
        };
      })
    );

    res.json({ success: true, data: trainersWithPhotos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
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
