import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  phone:    { type: String },
  password: { type: String, required: true },
  userRole: { 
    type: String, 
    enum: ["admin", "gym", "member"], 
    required: true 
  },
  status: { 
    type: String, 
    enum: ["active", "inactive", "suspended"], 
    default: "active" 
  },
}, { timestamps: true });

const User = mongoose.model("User", UserSchema);

export default User;
