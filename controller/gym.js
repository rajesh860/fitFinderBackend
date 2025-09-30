import Gym from "../models/gym.model.js";
import multer from "multer";
import path from "path";
import jwt from "jsonwebtoken";
// Multer setup for image upload
import fs from "fs";
import { GymPlan, Plan } from "../models/planSchema.js";
import User from "../models/user.model.js";

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
    const gyms = await User.find({userRole:"gym", status: "pending" });
   // Add base URL to images


res.json(gyms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// PUT /gym/:gym_id/approve
export const approveGym = async (req, res) => {
  try {
    const { gym_id } = req.params;
    const gym = await Gym.findByIdAndUpdate(gym_id, { status: "approved", updated_at: Date.now() }, { new: true });
    res.json({ success: true, message: "Gym approved successfully", });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// PUT /gym/:gym_id/reject
export const rejectGym = async (req, res) => {
  try {
    const { gym_id } = req.params;
    const { reason } = req.body;
    const gym = await Gym.findByIdAndUpdate(gym_id, { status: "rejected", updated_at: Date.now() }, { new: true });
    res.json({ success: true, message: "Gym rejected successfully", });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
// PUT /gym/:gym_id/suspen
export const suspendGym = async (req, res) => {
  try {
    const { gym_id } = req.params;
    const { status } = req.body;
    const { reason } = req.body;
    console.log(status,gym_id)
    const gym = await Gym.findByIdAndUpdate(gym_id, { status: status, updated_at: Date.now() }, { new: true });
    res.json({ success: true, message: `Gym ${status} successfully`, });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// GET /gym/list

export const getGymList = async (req, res) => {
  try {
    const { name } = req.query;

    // Base filter
    let filter = {
      status: { $in: ["approved", "suspended", "rejected"] },
    };

    // ✅ If name is passed, add case-insensitive search
    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    // ✅ Get all gyms + all plans
    const gymsPlan = await GymPlan.find();
    const gyms = await Gym.find(filter).select("-password");

    const gymsWithFullImages = gyms.map((gym) => {
      const fullImages = (gym.images || []).map(
        (img) => `${process.env.DOMAIN}/${img}`
      );

      const coverImage = (gym.coverImage || []).map(
        (img) => `${process.env.DOMAIN}/${img}`
      );

      // ✅ Match gymId with plans
      const plans = gymsPlan.filter(
        (plan) => plan.gymId?.toString() === gym._id.toString()
      );

      return {
        ...gym.toObject(),
        images: fullImages,
        coverImage,
        plans, // ✅ add matched plans here
      };
    });
    res.json({ success: true, data: gymsWithFullImages });
  } catch (err) {
    console.error("Error fetching gyms:", err.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};






export const getAllGymList = async (req, res) => {
  try {
    const {
      name,
      page = 1,
      limit = 3,
      minPrice,
      maxPrice,
      lat,
      lng,
      maxDistance,
    } = req.query;
    // ✅ Convert page & limit to numbers safely
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 3;

    // ✅ Convert query params to numbers safely
    const minPriceNum = minPrice && minPrice !== "undefined" ? parseInt(minPrice) : undefined;
    const maxPriceNum = maxPrice && maxPrice !== "undefined" ? parseInt(maxPrice) : undefined;
    const latNum = lat && lat !== "undefined" ? parseFloat(lat) : undefined;
    const lngNum = lng && lng !== "undefined" ? parseFloat(lng) : undefined;
    const maxDistanceNum = maxDistance && maxDistance !== "undefined" ? parseInt(maxDistance) : 1000;

    // Base filter
    let filter = {};
    if (name) filter.name = { $regex: name, $options: "i" };

    // Nearby filter only if lat & lng present
    if (latNum !== undefined && lngNum !== undefined) {
      filter.location = {
        $near: {
          $geometry: { type: "Point", coordinates: [lngNum, latNum] },
          $maxDistance: maxDistanceNum,
        },
      };
    }

    // Fetch gyms matching filter
    let gyms = await Gym.find(filter).select("-password");
    // Fetch all plans
    const gymsPlan = await GymPlan.find();

    // Attach images & plans
    let gymsWithFullImages = gyms.map((gym) => {
      const fullImages = (gym.images || []).map((img) => `${process.env.DOMAIN}/${img}`);
      const coverImage = `${process.env.DOMAIN}/${gym.coverImage}`

      // Match plans
      let plans = gymsPlan.filter(plan => plan.gymId?.toString() === gym._id.toString());

      // Apply price filter only if minPrice or maxPrice provided
      if (minPriceNum !== undefined || maxPriceNum !== undefined) {
        plans = plans.filter(plan => {
          const price = plan.price || 0;
          if (minPriceNum !== undefined && maxPriceNum !== undefined) return price >= minPriceNum && price <= maxPriceNum;
          if (minPriceNum !== undefined) return price >= minPriceNum;
          if (maxPriceNum !== undefined) return price <= maxPriceNum;
          return true;
        });
      }

      return {
        ...gym.toObject(),
        images: fullImages,
        coverImage,
        plans,
      };
    });

    // Remove gyms with no plans only if price filter applied
    if (minPriceNum !== undefined || maxPriceNum !== undefined) {
      gymsWithFullImages = gymsWithFullImages.filter(gym => gym.plans.length > 0);
    }

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
        totalPages: Math.ceil(totalGyms / limitNumber),
      },
    });

  } catch (err) {
    console.error("Error fetching gyms:", err.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};






export const getGymDetail = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(id,"gyguhj")
    if (!id) {
      return res
      .status(400)
      .json({ success: false, message: "Gym ID is required" });
    }
    
    const SERVER_URL = process.env.DOMAIN; // ✅ Yaha apna actual base URL likho
    
    // ✅ Single gym fetch
    const gym = await Gym.findById(id).select("-password");
    if (!gym) {
      return res
        .status(404)
        .json({ success: false, message: "Gym not found" });
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
      logo: gym.logo
        ? `${SERVER_URL}/${gym.logo}`
        : null,
      coverImage: gym.coverImage
        ? `${SERVER_URL}/${gym.coverImage}`
        : null,
      images: gym.images?.map(
        (imgPath) => `${SERVER_URL}/${imgPath}`
      ) || [],
      plans: gymPlans,
    };

    res.json({ success: true, data: gymWithFullImages });
  } catch (err) {
    console.error("Error fetching gym:", err.message);
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
    const user = await User.findById(id)
    // ✅ Single gym fetch
    const gym = await Gym.findOne({user:user?.id}).select("-password").lean();
    const updatedData = {
      ...gym,
       name: user?.name,
  email: user?.email,
  phone: user?.phone,
    }
    console.log(updatedData,"bm,nmn k")
    if (!gym) {
      return res
        .status(404)
        .json({ success: false, message: "Gym not found" });
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
      logo: gym.logo
        ? `${SERVER_URL}/${gym.logo}`
        : null,
      coverImage: gym.coverImage
        ? `${SERVER_URL}/${gym.coverImage}`
        : null,
      images: gym.images?.map(
        (imgPath) => `${SERVER_URL}/${imgPath}`
      ) || [],
      owner_image: gym.owner_image?.map(
        (imgPath) => `${SERVER_URL}/${imgPath}`
      ) || [],
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
    updateData.gymCertificates = req.files["gymCertificates"].map(file => file.path);
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
    const updatedGym = await Gym.findOneAndUpdate({ user: gymId }, updateData, {
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






