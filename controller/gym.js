import Gym from "../models/gym.model.js";
import multer from "multer";
import path from "path";
import jwt from "jsonwebtoken";
// Multer setup for image upload
import fs from "fs";
import { GymPlan, Plan } from "../models/planSchema.js";
import User from "../models/user.model.js";
import { sendGymApprovalEmail } from "../utils/emailService.js";
import Member from "../models/member.model.js";
import MembershipHistory from "../models/planHistroy.model.js";
import {getPresignedUrl} from "../middleware/presigned.js"
import { s3 } from "../config/s3.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
export const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

export const upload = multer({ storage: storage });
// POST /gym/register

// GET /gym/pending
export const getPending = async (req, res) => {
  try {
    const gyms = await User.find({ userRole: "gym", status: "pending" }).select(
      "-password"
    );
    // Add base URL to images

    res.json({ data: gyms, status: 200, success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// PUT /gym/:gym_id/approve
export const approveGym = async (req, res) => {
  try {
    const { gym_id } = req.params;
    const gym = await User.findByIdAndUpdate(
      gym_id,
      { status: "active", updated_at: Date.now() },
      { new: true }
    );
    // ✅ 2. Send Email Notification
    await sendGymApprovalEmail(gym.email, gym.name);
    res.json({ success: true, message: "Gym Activated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// PUT /gym/:gym_id/reject
export const rejectGym = async (req, res) => {
  try {
    const { gym_id } = req.params;
    const { reason } = req.body;
    const gym = await Gym.findByIdAndUpdate(
      gym_id,
      { status: "rejected", updated_at: Date.now() },
      { new: true }
    );
    res.json({ success: true, message: "Gym rejected successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
// PUT /gym/:gym_id/suspen
export const suspendGym = async (req, res) => {
  try {
    const { gym_id } = req.params;
    const { status, reason } = req.body;

    // 🧩 Step 1: Gym find karo
    const gym = await Gym.findById(gym_id);

    if (!gym) {
      return res.status(404).json({ success: false, message: "Gym not found" });
    }

    // 🧩 Step 2: Gym status update karo
    gym.status = status;
    gym.updated_at = Date.now();
    if (reason) gym.reason = reason;
    await gym.save();

    // 🧩 Step 3: Linked User status update karo
    if (gym.user) {
      await User.findByIdAndUpdate(
        gym.user,
        { status },
        { new: true }
      );
    }

    res.json({
      success: true,
      message: `Gym and user ${status} successfully`,
    });
  } catch (err) {
    console.error("❌ suspendGym error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};


// GET /gym/list

export const getGymList = async (req, res) => {
  try {
    const { name } = req.query;

    // Base filter (optional, Gym status filter)
    let filter = {};
    if (name) {
      filter.gymName = { $regex: name, $options: "i" };
    }

    // Fetch gyms and populate only active/inactive users
    const gyms = await Gym.find(filter)
      .populate({
        path: "user",
        match: { 
          userRole: "gym", 
          status: { $in: ["active", "inactive"] } 
        },
        select: "-password",
      })
      .lean();

    // Remove gyms whose user is null (user not active/inactive)
    const filteredGyms = gyms.filter((gym) => gym.user);

    // Fetch all gym plans
    const gymsPlan = await GymPlan.find().lean();

    // Map gyms with full image URLs and plans
    const gymsWithFullImages = filteredGyms.map((gym) => {
      const fullImages = (gym.images || []).map(
        (img) => `${process.env.DOMAIN}/${img}`
      );

      const coverImage = (gym.coverImage || []).map(
        (img) => `${process.env.DOMAIN}/${img}`
      );

      const plans = gymsPlan.filter(
        (plan) => plan.gymId?.toString() === gym._id.toString()
      );

      return {
        ...gym,
        images: fullImages,
        coverImage,
        plans,
      };
    });

    res.json({ success: true, data: gymsWithFullImages });
  } catch (err) {
    console.error("❌ getGymList error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};



export const getAllGymList = async (req, res) => {
  try {
    const {
      name,
      page = 1,
      limit = 3,
      minPrice, // max budget from user
      premium,  // premium filter
      lat,
      lng,
      maxDistance,
    } = req.query;
    // Convert page & limit
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 3;

    // Convert query params
    const maxPriceNum = minPrice && minPrice !== "undefined" ? parseInt(minPrice) : undefined;
    const premiumFlag = premium === "true";
    const latNum = lat && lat !== "undefined" ? parseFloat(lat) : undefined;
    const lngNum = lng && lng !== "undefined" ? parseFloat(lng) : undefined;
    const maxDistanceNum = maxDistance && maxDistance !== "undefined" ? parseInt(maxDistance) : 1000;

    // Base filter
    let filter = {};
    if (name) filter.gymName = { $regex: name, $options: "i" };

    // Apply price / premium filter
    if (premiumFlag) {
      filter.fees_monthly = { $gt: 1000 }; // premium gyms
    } else if (maxPriceNum !== undefined) {
      filter.fees_monthly = { $lte: maxPriceNum }; // gyms under user's max price
    }

    // Nearby filter
    if (latNum !== undefined && lngNum !== undefined) {
      filter.location = {
        $near: {
          $geometry: { type: "Point", coordinates: [lngNum, latNum] },
          $maxDistance: maxDistanceNum,
        },
      };
    }

    // Fetch gyms
    let gyms = await Gym.find(filter).populate("user").select("-password");

    // Only gyms whose user.status is active
    gyms = gyms.filter((gym) => gym.user?.status === "active");

    // Map images
    let gymsWithFullImages = gyms.map((gym) => {
      const fullImages = (gym.images || []).map(
        (img) => `${process.env.DOMAIN}/${img}`
      );
      const coverImage = gym.coverImage[0] && getPresignedUrl(gym.coverImage[0]);
      return {
        ...gym.toObject(),
        images: fullImages,
        coverImage,
      };
    });

    // Pagination
    const totalGyms = gymsWithFullImages.length;
    const paginatedGyms = gymsWithFullImages.slice(
      (pageNumber - 1) * limitNumber,
      pageNumber * limitNumber
    );
    res.json({
      success: true,
      data: paginatedGyms,
      pagination: {
        total: totalGyms,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(totalGyms.length / limitNumber),
      },
    });
  } catch (err) {
    console.error("Error fetching gyms:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};






export const getGymDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Gym ID is required" });
    }

    const SERVER_URL = process.env.DOMAIN; // ✅ Yaha apna actual base URL likho
  const member = await Member.findOne({ user: userId });
  const currentGymId = member?.currentGym?.gym;
    // ✅ Single gym fetch
    const gym = await Gym.findById(id).populate("user", "-password");
    if (!gym) {
      return res.status(404).json({ success: false, message: "Gym not found" });
    }

    // ✅ Gym plans lao
    const gymPlansRaw = await GymPlan.find({ gymId: id });
    // ✅ Plans ke names fetch karo (manual join)
    const gymPlans = await Promise.all(
      gymPlansRaw.map(async (gp) => {
        const plan = await Plan.findById(gp.planId).select("name");
        return {
          ...gp.toObject(),
          planName: plan ? plan.name : null,
        };
      })
    );
    // ✅ Final response
    const gymWithFullImages = {
      ...gym.toObject(),
      logo: gym.logo ? `${SERVER_URL}/${gym.logo}` : null,
      coverImage: gym.coverImage ? `${SERVER_URL}/${gym.coverImage}` : null,
      owner_image: gym.owner_image ? `${SERVER_URL}/${gym.owner_image}` : null,
      images: gym.images?.map((imgPath) => `${SERVER_URL}/${imgPath}`) || [],
      plans: gymPlans,
      currentGymId
    };

    res.json({ success: true, data: gymWithFullImages });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const gymProfile = async (req, res) => {
  try {
    const { id } = req.user;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Gym ID is required" });
    }

    const SERVER_URL = process.env.DOMAIN; // ✅ Yaha apna actual base URL likho
    const user = await User.findById(id);
    // ✅ Single gym fetch

    const gym = await Gym.findOne({ user: user?.id })
      .select("-password")
      .lean();
    const updatedData = {
      ...gym,
      name: user?.name,
      email: user?.email,
      phone: user?.phone,
    };
    if (!gym) {
      return res.status(404).json({ success: false, message: "Gym not found" });
    }

    // ✅ Gym plans lao
    const gymPlansRaw = await GymPlan.find({ gymId: id });

    // ✅ Plans ke names fetch karo (manual join)
    const gymPlans = await Promise.all(
      gymPlansRaw.map(async (gp) => {
        const plan = await Plan.findById(gp.planId).select("name");
        return {
          ...gp,
          planName: plan ? plan.name : null,
        };
      })
    );

    // ✅ Final response
    // console.log(getPresignedUrl(gym.owner_image))
    const gymWithFullImages = {
  ...updatedData,
  logo: gym.logo ? await getPresignedUrl(gym.logo) : null,
  coverImage: gym.coverImage
    ? await  getPresignedUrl(gym.coverImage[0])
    : [],
  images: gym.images
    ? await Promise.all(gym.images.map((key) => getPresignedUrl(key)))
    : [],
  owner_image: gym.owner_image
    ? await getPresignedUrl(gym.owner_image[0])
    : null,
  plans: gymPlans,
};

    res.json({ success: true, data: gymWithFullImages });
  } catch (err) {
    console.error("Error fetching gym:", err.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// PUT /gym/:id
export const updateGym = async (req, res) => {
  try {
    const gymId = req.params.id;

    // Pehle current gym data uthao
    const existingGym = await Gym.findById(gymId);
    if (!existingGym) {
      return res.status(404).json({ success: false, message: "Gym not found" });
    }

    const updateData = { ...req.body }; // normal fields

    // ✅ Handle file uploads
    if (req.files) {
      // Owner image (single)
      if (req.files.owner_image && req.files.owner_image.length > 0) {
        updateData.owner_image = req.files.owner_image[0].key;
      }

      // Cover image (single)
      if (req.files.coverImage && req.files.coverImage.length > 0) {
        updateData.coverImage = req.files.coverImage[0].key; // maxCount=1
      }

      // Gallery images (multiple)
      if (req.files.images && req.files.images.length > 0) {
        // const newGalleryImages = req.files.images.map((f) => f.key);

        // Merge existing images with new ones
      updateData.images = [...(existingGym.images || []), ...req.files.images.map(f => f.key)];
      }

      // Gym Certificates (multiple)
      if (req.files.gymCertificates && req.files.gymCertificates.length > 0) {
        updateData.gymCertificates = req.files.gymCertificates.map((f) => f.key);
      }
    }

    // ✅ Update location
    if (req.body.longitude && req.body.latitude) {
      const longitude = parseFloat(req.body.longitude);
      const latitude = parseFloat(req.body.latitude);

      if (isNaN(longitude) || isNaN(latitude)) {
        return res.status(400).json({
          success: false,
          message: "Valid longitude and latitude are required",
        });
      }

      updateData.location = {
        type: "Point",
        coordinates: [longitude, latitude],
      };
    }

    // ✅ Update gym
    const updatedGym = await Gym.findByIdAndUpdate(gymId, updateData, { new: true });

    res.json({
      success: true,
      message: "Gym updated successfully",
      // data: updatedGym
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};




export const renewGymPlanByAdmin = async (req, res) => {
  try {
    const ownerId = req.user.id; // gym owner/admin
    const { memberId, gymId, planId } = req.body; // frontend se pass

    if (!memberId || !gymId || !planId) {
      return res.status(400).json({
        success: false,
        message: "memberId, gymId, and planId are required",
      });
    }

    // 1️⃣ Check gym ownership
    const ownerGym = await Gym.findOne({ user: ownerId, _id: gymId });
    if (!ownerGym) {
      return res.status(403).json({
        success: false,
        message: "Not authorized or gym not found",
      });
    }

    // 2️⃣ Fetch member
    const member = await Member.findById(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    // 3️⃣ Validate plan
    const gymPlan = await GymPlan.findOne({
      gymId,
      _id: planId,
    }).populate("planId", "name durationInMonths");

    if (!gymPlan) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan for this gym",
      });
    }

    // 4️⃣ Expire current active plan (currentGym + history)
    if (member.currentGym?.gym?.toString() === gymId.toString()) {
      // expire currentGym
      member.currentGym.status = "expired";

      // expire matching plan in MembershipHistory
      await MembershipHistory.updateMany(
        {
          member: member._id,
          gym: gymId,
          status: "active",
        },
        { $set: { status: "expired" } }
      );
    }

    // 5️⃣ Set new membership dates
    const startDate = new Date();
    const durationMonths = parseInt(gymPlan.durationInMonths, 10) || 1;
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + durationMonths);

    // 6️⃣ Update currentGym
    member.currentGym = {
      gym: gymId,
      plan: planId,
      membership_start: startDate,
      membership_end: endDate,
      status: "active",
    };
    member.fee_status = "paid";

    await member.save();

    // 7️⃣ Add new record to MembershipHistory
    await MembershipHistory.create({
      member: member._id,
      gym: gymId,
      plan: planId,
      membership_start: startDate,
      membership_end: endDate,
      status: "active",
    });

    return res.status(200).json({
      success: true,
      message: `✅ Plan renewed successfully for member ${member._id}`,
      data: {
        memberId: member._id,
        gymId,
        planName: gymPlan.planId.name,
        membership_start: startDate,
        membership_end: endDate,
      },
    });
  } catch (err) {
    console.error("❌ Error in renewGymPlanByAdmin:", err);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: err.message,
    });
  }
};







export const deleteGalleryImage = async (req, res) => {
  try {
    const { gymId, imageKey, type } = req.body;
    
    if (!gymId || !imageKey || !type) {
      return res.status(400).json({ success: false, message: "Gym ID, Image Key & Type required" });
    }
    
    // Build the exact path stored in DB
    const key = `uploads/${decodeURIComponent(imageKey)}`; 
    console.log("Deleting image:", key);
    const command = new DeleteObjectCommand({
      Bucket: "fitcrewimages", // ya "fitcrewimages"
      Key: key, // example: uploads/1759923520091-998045494-WhatsApp%20Image...
    });
    // console.log(command,"command")
    await s3.send(command);

    let update = {};
    if (type === "gallery") {
      update = { $pull: { images: key } };
    } else if (type === "owner") {
      update = { $pull: { owner_image: key } };
    } else if (type === "cover") {
      update = { $pull: { coverImage: key } };
    } else {
      return res.status(400).json({ success: false, message: "Invalid type" });
    }

    const updatedGym = await Gym.findByIdAndUpdate(gymId, update, { new: true });

    if (!updatedGym) {
      return res.status(404).json({ success: false, message: "Gym not found" });
    }

    console.log("Updated images:", updatedGym.images);

    return res.json({
      success: true,
      message: `${type} image deleted successfully`,
      data: updatedGym,
    });

  } catch (error) {
    console.error("Delete Image Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

