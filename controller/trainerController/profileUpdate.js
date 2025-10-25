import { getPresignedUrl } from "../../middleware/presigned.js";
import Trainer from "../../models/trainer.model.js";
import User from "../../models/user.model.js";
import { deleteFileFromS3 } from "../../utils/s3Service.js";

export const updateProfile = async (req, res) => {
  try {
    const { trainerId } = req.params;
    const { specialization, experience, bio, slots, name } = req.body;

    if (!trainerId) {
      return res.status(400).json({
        success: false,
        message: "Trainer ID is required.",
      });
    }

    const trainer = await Trainer.findById(trainerId).populate("user");
    if (!trainer) {
      return res.status(404).json({
        success: false,
        message: "Trainer not found.",
      });
    }

    // ✅ Handle new photo upload
    if (req.files && req.files.photo && req.files.photo[0]) {
      const newPhotoUrl = req.files.photo[0].key;

      // ❌ Delete old photo if exists
      if (trainer.photo) {
        await deleteFileFromS3(trainer.photo);
      }

      trainer.photo = newPhotoUrl;
    }

    // ✅ Update basic trainer fields
    if (specialization)
      trainer.specialization = Array.isArray(specialization)
        ? specialization
        : [specialization];
    if (experience) trainer.experience = experience;
    if (bio) trainer.bio = bio;

    // ✅ Update linked user name (if provided)
    if (name && trainer.user) {
      const user = await User.findById(trainer.user._id);
      if (user) {
        user.name = name;
        await user.save();
      }
    }

    // ✅ Handle personal training slots
    if (slots && Array.isArray(slots)) {
      const validDays = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ];

      // 1️⃣ Clear all existing personalTraining
      trainer.availability.forEach((dayEntry) => {
        dayEntry.personalTraining = [];
      });

      // 2️⃣ Rebuild from payload
      slots.forEach((slot) => {
        const { slotNumber, days, startTime, endTime } = slot;
        if (!slotNumber || !Array.isArray(days) || days.length === 0 || !startTime || !endTime)
          return;

        days.forEach((day) => {
          if (!validDays.includes(day)) return;

          let dayEntry = trainer.availability.find((a) => a.day === day);
          if (!dayEntry) {
            dayEntry = { day, personalTraining: [] };
            trainer.availability.push(dayEntry);
          }

          dayEntry.personalTraining.push({ slotNumber, startTime, endTime });
        });
      });
    }

    await trainer.save();

    return res.status(200).json({
      success: true,
      message: "Trainer profile updated successfully.",
      data: trainer,
    });
  } catch (error) {
    console.error("❌ Error updating trainer profile:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating profile.",
    });
  }
};





export const getTrainerDetail = async (req, res) => {
  try {
    const { id } = req.params;

    // Find trainer by ID and populate related data
    const trainer = await Trainer.findById(id)
      .populate("user", "name email phone")
      .populate("gyms", "name location address images")
      .populate("bookings.client", "name email")
      .populate("bookings.gym", "name");

    if (!trainer) {
      return res.status(404).json({
        success: false,
        message: "Trainer not found",
      });
    }

    // Generate presigned URLs for trainer photos
    const presignedUrls = await Promise.all(
      (trainer.photo || []).map((img) => getPresignedUrl(img))
    );

    // Convert Mongoose doc to plain object and replace photo array
    const trainerData = {
      ...(trainer.toObject ? trainer.toObject() : trainer),
      photo: presignedUrls[0],
    };

    // Send the response
    res.status(200).json({
      success: true,
      data: trainerData,
    });
  } catch (error) {
    console.error("Error fetching trainer detail:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching trainer details",
      error: error.message,
    });
  }
};
