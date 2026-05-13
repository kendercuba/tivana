import express from "express";
import {
  getZmWeeklyFinanceOverview,
  fridayWeekRangeContaining,
} from "../../finance/services/zmWeeklyFinanceOverviewService.mjs";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const weekStart = req.query.weekStart || null;
    const bankAccountId = req.query.bankAccountId || null;
    const data = await getZmWeeklyFinanceOverview({
      weekStartFriday: weekStart,
      bankAccountId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error resumen semanal ZM:", error);
    const status = /inválid/i.test(error.message || "") ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Error generando resumen semanal.",
      error: error.message,
    });
  }
});

/** Helper for UI presets: given any YYYY-MM-DD, returns Fri–Thu bounds. */
router.get("/week-bounds", (req, res) => {
  try {
    const d = req.query.date || new Date().toISOString().slice(0, 10);
    const bounds = fridayWeekRangeContaining(d);
    return res.json({ success: true, data: bounds });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error.",
    });
  }
});

export default router;
