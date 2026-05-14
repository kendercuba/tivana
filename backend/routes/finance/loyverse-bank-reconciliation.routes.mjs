import express from "express";
import { getLoyverseBankReconciliationSnapshot } from "../../finance/services/loyverseBankReconciliationService.mjs";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const data = await getLoyverseBankReconciliationSnapshot({
      businessDate: req.query.date || req.query.businessDate,
      bankAccountId: req.query.bankAccountId,
      paymentMethod: req.query.paymentMethod,
      posBatch: req.query.posBatch,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error conciliación Loyverse–banco:", error);
    const status = /inválid|obligatoria/i.test(error.message || "") ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Error generando conciliación.",
      error: error.message,
    });
  }
});

export default router;
