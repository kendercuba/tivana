import express from "express";
import {
  getLoyverseBankReconciliationSnapshot,
  getLoyverseBankMatchStatusesInRange,
} from "../../finance/services/loyverseBankReconciliationService.mjs";

const router = express.Router();

router.get("/match-statuses", async (req, res) => {
  try {
    const data = await getLoyverseBankMatchStatusesInRange({
      startYmd: req.query.startYmd || req.query.start,
      endYmd: req.query.endYmd || req.query.end,
      bankAccountId: req.query.bankAccountId,
      paymentMethod: req.query.paymentMethod,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error cotejo Loyverse–banco por rango:", error);
    const status = /inválid|obligatoria|máximo/i.test(error.message || "")
      ? 400
      : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Error generando cotejo.",
      error: error.message,
    });
  }
});

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
