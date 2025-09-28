import mongoose from "mongoose";

const GymSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  gymName: {type:String,default:""},
  contact: {type:String,default:""},
  address: {type:String,default:""},
  fees_trial: {type:Number,default:""},
  fees_monthly: {type:Number,default:""},
  aboutGym: {type:String,default:""},
  owner_image:[String],
  coverImage: [String],
  images: [String],
  gymCertificates: [String],

  status: { type: String, enum:["pending","rejected","approved"], default: "pending" },

  location: {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
      default: "Point"
    },
    coordinates: {
      type: [Number],
      required: true,
      default: [0, 0] // default coordinates agar nahi mile
    }
  }
});

// Geo index
GymSchema.index({ location: "2dsphere" });

const Gym = mongoose.model("Gym", GymSchema);
export default Gym;
