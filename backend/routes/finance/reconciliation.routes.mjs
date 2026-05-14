import express from "express";
import {
  getPurchaseReconciliationSummary,
  getPurchaseReconciliationDay,
  createPurchaseReconciliationLink,
  createPurchaseReconciliationLinksBatch,
  deletePurchaseReconciliationLink,
} from "../../finance/services/financeReconciliationService.mjs";

const router = express.Router();

router.get("/purchase-summary", async (req, res) => {
  try {
    const windowDays = req.query.windowDays;
    const data = await getPurchaseReconciliationSummary({ windowDays });
    return res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error resumen conciliación compras:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error cargando resumen.",
    });
  }
});

router.get("/purchase-day", async (req, res) => {
  try {
    const date = String(req.query.date || "").slice(0, 10);
    const includeReconciled =
      String(req.query.includeReconciled || "").toLowerCase() === "1" ||
      String(req.query.includeReconciled || "").toLowerCase() === "true";
    const data = await getPurchaseReconciliationDay({
      businessDate: date,
      includeReconciled,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error conciliación compras del día:", error);
    const status = /inválid/i.test(error.message || "") ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Error cargando datos.",
    });
  }
});

router.post("/purchase-links", express.json(), async (req, res) => {
  try {
    const bodyPairs = req.body?.pairs;
    if (Array.isArray(bodyPairs) && bodyPairs.length > 0) {
      const data = await createPurchaseReconciliationLinksBatch({ pairs: bodyPairs });
      return res.json({ success: true, data });
    }
    const row = await createPurchaseReconciliationLink({
      bankMovementId: req.body?.bankMovementId ?? req.body?.bank_movement_id,
      zmPoLineId: req.body?.zmPoLineId ?? req.body?.zm_po_line_id,
    });
    return res.json({ success: true, data: row });
  } catch (error) {
    console.error("❌ Error creando vínculo conciliación:", error);
    const status = /inválid|Enviá|máximo/i.test(error.message || "") ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Error guardando vínculo.",
    });
  }
});

router.delete("/purchase-links/:bankMovementId", async (req, res) => {
  try {
    const result = await deletePurchaseReconciliationLink({
      bankMovementId: req.params.bankMovementId,
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("❌ Error borrando vínculo conciliación:", error);
    const status = /inválid/i.test(error.message || "") ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Error borrando vínculo.",
    });
  }
});

export default router;
