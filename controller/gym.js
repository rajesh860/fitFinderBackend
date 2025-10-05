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
      const coverImage = gym.coverImage[0] && `${process.env.DOMAIN}/${gym.coverImage[0]}`;
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
    const gymWithFullImages = {
      ...updatedData,
      logo: gym.logo ? `${SERVER_URL}/${gym.logo}` : null,
      coverImage: gym.coverImage ? `${SERVER_URL}/${gym.coverImage}` : null,
      images: gym.images?.map((imgPath) => `${SERVER_URL}/${imgPath}`) || [],
      owner_image:
        gym.owner_image?.map((imgPath) => `${SERVER_URL}/${imgPath}`) || [],
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
    const updateData = { ...req.body }; // User sent normal data
    // ✅ Handle file uploads
    if (req.files) {
      if (req.files.images) {
        updateData.images = req.files.images.map((file) => file.path);
      }
      if (req.files.coverImage) {
        updateData.coverImage = req.files.coverImage.map((file) => file.path);
      }
      if (req.files.owner_image) {
        updateData.owner_image = req.files.owner_image.map((file) => file.path);
      }
      // gymCertificates (multiple)
      if (req.files["gymCertificates"]) {
        updateData.gymCertificates = req.files["gymCertificates"].map(
          (file) => file.path
        );
      }
    }

    // ✅ If longitude & latitude sent, update location field
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

    // ✅ Update only sent fields
    const updatedGym = await Gym.findOneAndUpdate({ _id: gymId }, updateData, {
      new: true,
    });

    if (!updatedGym) {
      return res.status(404).json({ success: false, message: "Gym not found" });
    }

    res.json({
      success: true,
      message: "Gym updated successfully",
      // data: updatedGym,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};
