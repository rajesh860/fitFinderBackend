import mongoose from "mongoose";

const TrainerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    gyms: [{ type: mongoose.Schema.Types.ObjectId, ref: "Gym" }],
    specialization: [String],
    experience: String,
    bio: String,
    photo: [String],
    gallery:[String],
    // rating: { type: String, default: "0" },
    averageRating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },

    // 🔹 Trainer’s general weekly availability
    availability: [
      {
        day: {
          type: String,
          enum: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ],
          required: true,
        },
        // ✅ Multiple personal training slots (morning, evening, etc.)
        personalTraining: [
          {
              slotNumber: { type: Number, required: true }, // 1 or 2
            startTime: String, // "05:00"
            endTime: String,   // "08:00"
          },
        ],

        // ✅ Gym working hours (optional)
        gymTraining: {
          gym: { type: mongoose.Schema.Types.ObjectId, ref: "Gym" },
          startTime: String,
          endTime: String,
        },
      },

    ],

    // 🔹 Booked Slots
 // 🧾 Simplified Bookings (monthly-based)


    // 🪙 Trainer Subscription Plans
    plans: [
      {
        name: { type: String, required: true }, // e.g. "1 Month Plan", "3 Month Plan"
        durationMonths: { type: Number, required: true }, // e.g. 1, 3, 6
        price: { type: Number, required: true }, // price in ₹ or $
        description: { type: String },
        benefits: [String], // e.g. ["Diet plan", "Weekly Progress Tracking"]
        isActive: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    bookings: [
      {
        client: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        type: { type: String, enum: ["personal", "gym"], required: true },
        month: { type: Number, required: true }, // e.g. 10 = October
        year: { type: Number, required: true },  // e.g. 2025
        timeSlot: {
          startTime: { type: String, required: true }, // e.g. "05:00"
          endTime: { type: String, required: true },   // e.g. "06:00"
        },
        gym: { type: mongoose.Schema.Types.ObjectId, ref: "Gym" },
        status: {
          type: String,
          enum: ["active", "cancelled", "completed"],
          default: "active",
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const Trainer = mongoose.model("Trainer", TrainerSchema);
export default Trainer;
