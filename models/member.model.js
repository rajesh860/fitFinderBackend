import mongoose from "mongoose";
import { type } from "os";

const EmergencyContactSchema = new mongoose.Schema({
  name: String,
  phone: String,
  relation: String,
});


const CurrentMembershipSchema = new mongoose.Schema({
  gym: { type: mongoose.Schema.Types.ObjectId, ref: "Gym" },
  plan: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Plan",
    default: null  // ✅ Allow null values
  },
  // planName: {  // ✅ New field for storing plan name directly
  //   type: String,
  //   default: "N/A"
  // },
  membership_start: { type: Date, default: Date.now },
  membership_end: { type: Date },
  removedBy: { type: String },
  status: {
    type: String,
    enum: ["active", "expired", "removed"],
    default: "active",
  },
  trainers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Trainer" }],
});
const MemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    address: { type: String, default: "" },

    gender: {
      type: String,
      enum: ["Male", "Female", "Other", "None"],
      default: "None",
    },

    dob: { type: String, default: "" },
    photo: { type: String, default: "" },

    // gym: { type: mongoose.Schema.Types.ObjectId, ref: "Gym" },
    currentGym: CurrentMembershipSchema,
    gymHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: "GymHistory" }],
    membership_start: { type: Date, default: Date.now },
    membership_end: { type: Date },
    fee_amount: Number,
    fee_status: {
      type: String,
      enum: ["paid", "pending", "overdue"],
      default: "pending",
    },

    // blood_group: {
    //   type: String,
    //   enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", ""],
    //   default: "",
    // },
    medical_conditions: [String],
    injuries: [String],
    fitness_goals: [String],

    emergency_contacts: [EmergencyContactSchema],
    referred_by: String,
    occupation: String,
    notes: String,
  },
  { timestamps: true }
);

const Member = mongoose.model("Member", MemberSchema);
export default Member;
