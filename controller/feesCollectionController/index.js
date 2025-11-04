import feesCollectionModel from "../../models/feesCollection.model.js";

export const getAllFeeCollections = async (req, res) => {
  try {
    const { fee_status, searchText } = req.query;

    // ✅ Build base query
    let query = {};

    if (fee_status) {
      query["member.fee_status"] = fee_status;
    }

    // ✅ Fetch collections with related data
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

    // ✅ If searchText exists → match by name, email, phone, or userId
    if (searchText && searchText.trim() !== "") {
      const regex = new RegExp(searchText, "i"); // case-insensitive partial match

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

    // 🧮 Calculate summary
    const totalFees = filteredCollections.reduce(
      (sum, item) => sum + (item.totalAmount || 0),
      0
    );
    const totalCollection = filteredCollections.reduce(
      (sum, item) => sum + (item.paidAmount || 0),
      0
    );
    const totalPending = filteredCollections.reduce(
      (sum, item) => sum + (item.pendingAmount || 0),
      0
    );

    // 🟠 Handle empty results
    if (!filteredCollections.length) {
      return res.status(200).json({
        success: false,
        message: "No fee collection found",
        data: [],
        summary: { totalFees: 0, totalCollection: 0, totalPending: 0 },
      });
    }

    // ✅ Final response
    res.status(200).json({
      success: true,
      data: filteredCollections,
      summary: { totalFees, totalCollection, totalPending },
    });
  } catch (err) {
    console.error("Error fetching fee collections:", err);
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

    // 🔹 Find fee collection
    const feeCollection = await feesCollectionModel
      .findById(feeCollectionId)
      .populate("member");

    if (!feeCollection) {
      return res.status(404).json({
        success: false,
        message: "Fee collection not found",
      });
    }

    // 🔹 Validate amount
    const remainingAmount =
      feeCollection.totalAmount - feeCollection.paidAmount;
    if (amount > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: `Amount exceeds remaining pending amount: ₹${remainingAmount}`,
      });
    }

    // 🔹 Add new payment entry
    feeCollection.payments.push({
      amount,
      mode: mode || "cash",
      remark: remark || "Additional payment",
    });

    // 🔹 Update paidAmount, pendingAmount, status
    feeCollection.paidAmount += amount;
    feeCollection.pendingAmount =
      feeCollection.totalAmount - feeCollection.paidAmount;

    if (feeCollection.pendingAmount === 0) {
      feeCollection.status = "completed";

      // 🔹 Update member's fee_status to "paid"
      if (feeCollection.member) {
        feeCollection.member.fee_status = "paid";
        await feeCollection.member.save();
      }
    } else {
      feeCollection.status = "pending";
    }

    await feeCollection.save();

    res.status(200).json({
      success: true,
      message: "Payment added successfully",
      data: feeCollection,
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
