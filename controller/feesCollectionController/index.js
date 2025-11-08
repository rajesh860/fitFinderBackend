import feesCollectionModel from "../../models/feesCollection.model.js";

export const getAllFeeCollections = async (req, res) => {
  try {
    const { fee_status, searchText } = req.query;

    let query = {};
    if (fee_status) query["current.status"] = fee_status;

    const collections = await feesCollectionModel
      .find(query)
      .populate({
        path: "member",
        populate: {
          path: "user",
          select: "name email phone userId",
        },
      })
      .populate("gym", "name location");

    let filteredCollections = collections;

    if (searchText && searchText.trim() !== "") {
      const regex = new RegExp(searchText, "i");
      filteredCollections = collections.filter((c) => {
        const user = c.member?.user;
        const userId = String(user?._id || "");
        return (
          regex.test(user?.name || "") ||
          regex.test(user?.email || "") ||
          regex.test(user?.phone || "") ||
          regex.test(userId)
        );
      });
    }

    const totalFees = filteredCollections.reduce(
      (sum, item) => sum + (item.current?.totalAmount || 0),
      0
    );
    const totalCollection = filteredCollections.reduce(
      (sum, item) => sum + (item.current?.paidAmount || 0),
      0
    );
    const totalPending = filteredCollections.reduce(
      (sum, item) => sum + (item.current?.pendingAmount || 0),
      0
    );

    if (!filteredCollections.length) {
      return res.status(200).json({
        success: false,
        message: "No fee collection found",
        data: [],
        summary: { totalFees: 0, totalCollection: 0, totalPending: 0 },
      });
    }

    // ✅ Final Response — removed top-level paidAmount & pendingAmount
    res.status(200).json({
      success: true,
      message: "Fee collections fetched successfully",
      data: filteredCollections.map((c) => ({
        _id: c._id,
        gym: c.gym,
        member: c.member,
        current: c.current, // ✅ Actual current data
        payments: c.payments || [],
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      summary: { totalFees, totalCollection, totalPending },
    });
  } catch (err) {
    console.error("❌ Error fetching fee collections:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};






export const addPendingPayment = async (req, res) => {
  try {
    const { feeCollectionId, amount, mode, remark } = req.body;

    if (!feeCollectionId || !amount) {
      return res.status(400).json({
        success: false,
        message: "feeCollectionId and amount are required",
      });
    }

    // 🔹 Find fee collection with member population
    const feeCollection = await feesCollectionModel
      .findById(feeCollectionId)
      .populate("member");

    if (!feeCollection) {
      return res.status(404).json({
        success: false,
        message: "Fee collection not found",
      });
    }

    // 🔹 Validate amount against current plan's pending amount
    const currentPlan = feeCollection.current;
    if (!currentPlan) {
      return res.status(400).json({
        success: false,
        message: "No current plan found for this fee collection",
      });
    }

    const remainingAmount = currentPlan.pendingAmount;
    
    if (amount > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: `Amount exceeds remaining pending amount: ₹${remainingAmount}`,
      });
    }

    // 🔹 Create new payment object (using CurrentPlanSchema structure)
    const newPayment = {
      planName: currentPlan.planName,
      totalAmount: currentPlan.totalAmount,
      paidAmount: amount,
      pendingAmount: remainingAmount - amount,
      startDate: currentPlan.startDate,
      endDate: currentPlan.endDate,
      status: (remainingAmount - amount) === 0 ? "completed" : "pending",
      mode: mode || "cash",
      remark: remark || "Additional payment",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 🔹 Add new payment to payments array
    feeCollection.payments.push(newPayment);

    // 🔹 Update current plan amounts and status
    currentPlan.paidAmount += amount;
    currentPlan.pendingAmount = remainingAmount - amount;
    
    if (currentPlan.pendingAmount === 0) {
      currentPlan.status = "completed";

      // 🔹 Update member's fee_status to "paid"
      if (feeCollection.member) {
        feeCollection.member.fee_status = "paid";
        await feeCollection.member.save();
      }
    } else {
      currentPlan.status = "pending";
    }

    currentPlan.updatedAt = new Date();

    // 🔹 Save the updated fee collection
    await feeCollection.save();

    // 🔹 Populate again to get updated data in response
    const updatedFeeCollection = await feesCollectionModel
      .findById(feeCollectionId)
      .populate("member")
      .populate("gym");

    res.status(200).json({
      success: true,
      message: "Payment added successfully",
      data: updatedFeeCollection,
    });
  } catch (err) {
    console.error("Error adding payment:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

export const getFeeCollectionByMember = async (req, res) => {
  try {
    const { memberId } = req.params;

    const collections = await feesCollectionModel
      .find({ member: memberId })
      .populate("gym", "name location")
      .populate("member", "name email phone");

    if (!collections || collections.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No fee collection found for this member",
      });
    }

    res.status(200).json({
      success: true,
      data: collections,
    });
  } catch (err) {
    console.error("Error fetching member fee collection:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};
