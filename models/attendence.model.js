import mongoose from "mongoose";

const AttendanceSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    gym: { type: mongoose.Schema.Types.ObjectId, ref: "Gym", required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["present", "absent"], default: "present" },
  },
  { timestamps: true }
);

const Attendance = mongoose.model("Attendance", AttendanceSchema);
export default Attendance;
