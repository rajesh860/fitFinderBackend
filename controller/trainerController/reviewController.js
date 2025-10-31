import mongoose from "mongoose";
import Trainer from "../../models/trainer.model.js";
import TrainerReview from "../../models/trainerReview.js";

export const addTrainerReview = async (req, res) => {
  try {
    const { trainerId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id; // assuming JWT or auth middleware

    // ✅ Create review
    const review = await TrainerReview.create({
      trainer: trainerId,
      user: userId,
      rating,
      comment,
    });

    // 🔄 Update trainer’s average rating + total reviews
    const stats = await TrainerReview.aggregate([
      { $match: { trainer: new mongoose.Types.ObjectId(trainerId) } },
      {
        $group: {
          _id: "$trainer",
          avgRating: { $avg: "$rating" },
          total: { $sum: 1 },
        },
      },
    ]);

    if (stats.length) {
      await Trainer.findByIdAndUpdate(trainerId, {
        averageRating: stats[0].avgRating.toFixed(1),
        totalReviews: stats[0].total,
      });
    }

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      data: review,
    });
  } catch (error) {
    console.error("Error adding trainer review:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};




export const getTrainerReviews = async (req, res) => {
  try {
    const { trainerId } = req.params;

    const reviews = await TrainerReview.find({ trainer: trainerId })
      .populate("user", "name userPhoto email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    console.error("Error fetching trainer reviews:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};




export const bookTrainer = async (req, res) => {
  try {
    const userId = req.user.id; // from auth middleware
    const { trainerId, type, month, year, timeSlot, gym } = req.body;

    if (!trainerId || !type || !month || !year || !timeSlot?.startTime || !timeSlot?.endTime) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: trainerId, type, month, year, timeSlot",
      });
    }

    const trainer = await Trainer.findById(trainerId);
    if (!trainer) {
      return res.status(404).json({ success: false, message: "Trainer not found" });
    }

    // ⚠️ Prevent duplicate booking for same user & month
    const alreadyBooked = trainer.bookings.some(
      (b) =>
        b.client.toString() === userId.toString() &&
        b.month === month &&
        b.year === year &&
        b.status === "active"
    );

    if (alreadyBooked) {
      return res.status(400).json({
        success: false,
        message: "You already have an active booking with this trainer for this month.",
      });
    }

    // ✅ Add booking
    const newBooking = {
      client: userId,
      type,
      month,
      year,
      timeSlot,
      gym,
    };

    trainer.bookings.push(newBooking);
    await trainer.save();

    res.status(201).json({
      success: true,
      message: "Trainer booked successfully for the month ✅",
      data: newBooking,
    });
  } catch (error) {
    console.error("Booking error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};



export const getTrainerAvailableSlots = async (req, res) => {
  try {
    const { trainerId } = req.params;

    // 🔹 Fetch trainer
    const trainer = await Trainer.findById(trainerId);
    if (!trainer) {
      return res
        .status(404)
        .json({ success: false, message: "Trainer not found" });
    }

    // 🔹 Get all active bookings (regardless of month/year)
    const activeBookings = trainer.bookings.filter(
      (b) => b.status === "active"
    );

    // 🔹 Extract booked slots (start-end pairs)
    const bookedSlots = activeBookings.map(
      (b) => `${b.timeSlot.startTime}-${b.timeSlot.endTime}`
    );

    // 🔹 Collect all available slots from trainer.availability
    let allSlots = [];
    trainer.availability.forEach((day) => {
      day.personalTraining.forEach((slot) => {
        allSlots.push({
          day: day.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
      });
    });

    // 🔹 Filter out booked slots
    const availableSlots = allSlots.filter(
      (slot) => !bookedSlots.includes(`${slot.startTime}-${slot.endTime}`)
    );

    // ✅ Response
    res.json({
      success: true,
      trainer: trainerId,
      availableSlots,
      bookedSlots,
      totalSlots: allSlots.length,
      availableCount: availableSlots.length,
    });
  } catch (err) {
    console.error("Error fetching available slots:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching available slots",
      error: err.message,
    });
  }
};




export const createTrainerPlan = async (req, res) => {
  try {
    const trainerId  = req.user.id;
    const { name, durationMonths, price, description, benefits } = req.body;

    // ✅ Basic Validation
    if (!name || !durationMonths || !price) {
      return res.status(400).json({
        success: false,
        message: "Name, durationMonths, and price are required.",
      });
    }

    // 🔍 Find Trainer
    const trainer = await Trainer.findOne({user:trainerId});
    if (!trainer) {
      return res.status(404).json({
        success: false,
        message: "Trainer not found.",
      });
    }

    // 🧱 Create new plan object
    const newPlan = {
      name,
      durationMonths,
      price,
      description: description || "",
      benefits: benefits || [],
      isActive: true,
      createdAt: new Date(),
    };

    // ➕ Push to trainer's plans array
    trainer.plans.push(newPlan);
    await trainer.save();

    // 🔁 Return the last added plan (the newly created one)
    const createdPlan = trainer.plans[trainer.plans.length - 1];

    res.status(201).json({
      success: true,
      message: "Plan created successfully!",
      plan: createdPlan,
    });
  } catch (error) {
    console.error("Error creating trainer plan:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating trainer plan.",
      error: error.message,
    });
  }
};