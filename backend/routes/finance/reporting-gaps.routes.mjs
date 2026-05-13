import express from "express";
import { getReportingGapsSnapshot } from "../../finance/services/reportingGapsService.mjs";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const data = await getReportingGapsSnapshot();
    return res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error reporting gaps snapshot:", error);
    return res.status(500).json({
      success: false,
      message: "Error cargando estado de reportes.",
      error: error.message,
    });
  }
});

export default router;
