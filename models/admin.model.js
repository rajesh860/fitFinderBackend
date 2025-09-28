import mongoose from "mongoose";

const AdminSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  // future me agar extra fields chahiye admin ke liye
});

const Admin = mongoose.model("Admin", AdminSchema);

export default Admin;