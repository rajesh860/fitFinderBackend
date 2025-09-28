import dayjs from "dayjs";
import {GymPlan, Plan} from "../../models/planSchema.js";
import Progress from "../../models/progess.model.js";
import {GymHistory} from "../../models/gymHistory.model.js";
import Member from "../../models/member.model.js";
import Gym from "../../models/gym.model.js";
// Create Plan
export const createPlan = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    // 🔍 Check if plan with same name already exists
    const existingPlan = await Plan.findOne({ name: name.trim() });
    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: "Plan with this name already exists",
      });
    }

    // ✅ Create new plan
    const plan = new Plan({
      name: name.trim(),
    });

    await plan.save();
    res.status(201).json({
      success: true,
      message: "Plan created successfully",
      plan,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error creating plan",
      error: error.message,
    });
  }
};





export const createGymPlan = async (req, res) => {
  try {
    const { planId, price, durationInMonths, features } = req.body;
    const gymId = req.user.id; // middleware se aa raha hoga (JWT)
    const findGym = await Gym.findOne({user:gymId})
console.log(req.user)
    if (!planId || !price || !durationInMonths) {
      return res.status(400).json({ message: "PlanId, Price and Duration are required" });
    }

    const gymPlan = new GymPlan({
      gymId:findGym?._id,
      planId,
      price,
      durationInMonths,
      features,
    });

    await gymPlan.save();
    res.status(201).json({success:true, message: "Gym Plan created successfully", "gymPlan":"" });
  } catch (error) {
    res.status(500).json({ message: "Error creating gym plan", error: error.message });
  }
};



// Get All Plans
export const getPlanName = async (req, res) => {
  try {
    const plans = await Plan.find();
    res.status(200).json(plans);
  } catch (error) {
    res.status(500).json({ message: "Error fetching plans", error: error.message });
  }
};


export const getMyPlans = async (req, res) => {
  try {
    const gymOwnerId = req.user.id // login se owner ka id aayega
    const findGym = await Gym.findOne({user:gymOwnerId})
    const plans = await GymPlan.find({ gymId: findGym?._id }).populate("planId", "name").lean(); // plain object ban jaye; // sirf name field lekar aayega
     const formattedPlans = plans.map(plan => ({
      _id: plan._id,
      gymId: plan.gymId,
      planId: plan.planId?._id || null,
      planName: plan.planId?.name || null,
      price: plan.price,
      durationInMonths: plan.durationInMonths,
      features: plan.features,
      created_at: plan.created_at,
      __v: plan.__v
    }));

    res.json(formattedPlans);

  } catch (error) {
    res.status(500).json({ message: "Error fetching plans", error: error.message });
  }
};




export const updateGymPlan = async (req, res) => {
  try {
    const { id } = req.params; // GymPlan ka ID
    const { price, durationInMonths, features } = req.body;

    // 🔍 Check if GymPlan exists
    const gymPlan = await GymPlan.findById(id);
    if (!gymPlan) {
      return res.status(404).json({
        success: false,
        message: "GymPlan not found",
      });
    }

    // 📝 Update fields only if provided
    if (price !== undefined) gymPlan.price = price;
    if (durationInMonths !== undefined) gymPlan.durationInMonths = durationInMonths;
    if (features !== undefined) gymPlan.features = features;

    await gymPlan.save();

    res.status(200).json({
      success: true,
      message: "GymPlan updated successfully",
      gymPlan,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating GymPlan",
      error: error.message,
    });
  }
};








export const buyPlan = async (req, res) => {
  try {
    const userId = req.user.id; // Authenticated user (User collection)
    const { gymPlanId } = req.body;

    if (!gymPlanId) {
      return res.status(400).json({ success: false, message: "Gym Plan ID is required" });
    }

    // ✅ Fetch GymPlan
    const gymPlan = await GymPlan.findById(gymPlanId);
    if (!gymPlan) {
      return res.status(404).json({ success: false, message: "Gym Plan not found" });
    }

    const startDate = dayjs();
    const endDate = startDate.add(Number(gymPlan.durationInMonths), "month");

    // ✅ Fetch Member by User ID
    const member = await Member.findOne({ user: userId });
    if (!member) {
      return res.status(404).json({ success: false, message: "Member profile not found" });
    }

    // 1️⃣ Update Member Info
    member.plan = gymPlan.planId;
    member.gym = gymPlan.gymId;
    member.fee_amount = gymPlan.price;
    member.fee_status = "paid";
    member.membership_start = startDate.toDate();
    member.membership_end = endDate.toDate();

    await member.save();

    // 2️⃣ GymHistory check and update/create
    const existingGymHistory = await GymHistory.findOne({
      member: member._id,
      gym: gymPlan.gymId,
      status: "active"
    });

    if (existingGymHistory) {
      existingGymHistory.plan = gymPlan.planId;
      existingGymHistory.membership_start = startDate.toDate();
      existingGymHistory.membership_end = endDate.toDate();
      existingGymHistory.updatedAt = new Date();
      await existingGymHistory.save();
    } else {
      await GymHistory.create({
        member: member._id,
        gym: gymPlan.gymId,
        plan: gymPlan.planId,
        membership_start: startDate.toDate(),
        membership_end: endDate.toDate(),
        status: "active"
      });
    }

    // 3️⃣ Initialize Progress for this gym
    const existingProgress = await Progress.findOne({ member: member._id, gym: gymPlan.gymId });
    if (!existingProgress) {
      await Progress.create({
        member: member._id,
        gym: gymPlan.gymId,
        current: {
          weight: null,
          height: null,
          arm: null,
          waist: null,
          thigh: null,
          chest: null,
          updatedBy: null,
          updatedAt: null
        },
        history: []
      });
    }

    res.status(200).json({
      success: true,
      message: "Plan purchased, gym history and progress initialized successfully",
      data: member
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};


