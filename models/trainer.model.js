import mongoose from "mongoose";

const TrainerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    gyms: [{ type: mongoose.Schema.Types.ObjectId, ref: "Gym" }],
    specialization: [String],
    experience: String,
    bio: String,
    photo: [String],
    rating: { type: String, default: "0" },

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
    bookings: [
      {
        client: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        type: { type: String, enum: ["personal", "gym"], required: true },
        dateRange: {
          startDate: { type: Date, required: true },
          endDate: { type: Date, required: true },
        },
        timeSlot: {
          startTime: { type: String, required: true },
          endTime: { type: String, required: true },
        },
        gym: { type: mongoose.Schema.Types.ObjectId, ref: "Gym" },
        status: {
          type: String,
          enum: ["active", "cancelled", "completed"],
          default: "active",
        },
      },
    ],
  },
  { timestamps: true }
);

const Trainer = mongoose.model("Trainer", TrainerSchema);
export default Trainer;
