import mongoose from "mongoose";

const EnquirySchema = new mongoose.Schema({
  gymId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Gym",
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
   uniqueNumber: {  // ✅ New Field
    type: String,
    unique: true,
     required: function () {
    return this.status === "completed"; // सिर्फ completed पर required
  },
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  
  status: {
    type: String,
    enum: ['pending','upcoming','completed','cancelled'],
    default: 'pending'
  },
resion:{
  type:String,

}
  ,

  cancellationReason: {
    type: String,
    default: ''
  }

}, { timestamps: true });

export const Enquiry = mongoose.model("Enquiry", EnquirySchema);
