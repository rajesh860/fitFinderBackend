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
export const getAllTrainerList  = async (req, res) => {
  try {
    // 👇 Assume gym id is passed as query OR get from logged-in user
  


    // Fetch trainers who belong to this gym
    const trainers = await Trainer.find()
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