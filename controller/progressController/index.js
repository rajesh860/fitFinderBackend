import mongoose from "mongoose";
import Progress from "../../models/progess.model.js";

export const editProgress = async (req, res) => {
  const { memberId } = req.params;
  const gymId = req.user.id; // ID of gym updating this
  const { weight, height, arm, waist, thigh, chest, bloodGroup } = req.body;

  if (!mongoose.Types.ObjectId.isValid(memberId)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid member ID" });
  }

  try {
    // Find the member's progress and populate references
    let progress = await Progress.findOne({ member: memberId })
      .populate("member", "name email phone") // populate member basic info
      .populate("current.updatedBy", "name email"); // populate gym info who updated current

    if (!progress) {
      return res
        .status(404)
        .json({ success: false, message: "Progress not found" });
    }

    // Update only current measurements
    progress.current = {
      weight: weight ?? progress.current.weight,
      height: height ?? progress.current.height,
      arm: arm ?? progress.current.arm,
      waist: waist ?? progress.current.waist,
      thigh: thigh ?? progress.current.thigh,
      chest: chest ?? progress.current.chest,
      bloodGroup: bloodGroup ?? progress.current.bloodGroup,
      updatedBy: gymId, // authenticated gym
      updatedAt: new Date(),
    };

    await progress.save();

    // Populate again to reflect updatedBy info
    const updatedProgress = await Progress.findById(progress._id)
      .populate("member", "name email phone")
      .populate("current.updatedBy", "name email");

    res.json({
      success: true,
      message: "Current measurements updated",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
