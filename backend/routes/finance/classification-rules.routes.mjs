import express from "express";
import {
  listBankClassificationRules,
  createBankClassificationRule,
  updateBankClassificationRule,
  deleteBankClassificationRule,
} from "../../finance/services/bankClassificationRulesService.mjs";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const data = await listBankClassificationRules();
    return res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error listando reglas de clasificación:", error);
    return res.status(500).json({
      success: false,
      message: "Error cargando reglas.",
      error: error.message,
    });
  }
});

router.post("/", express.json(), async (req, res) => {
  try {
    const row = await createBankClassificationRule(req.body || {});
    return res.status(201).json({ success: true, data: row });
  } catch (error) {
    console.error("❌ Error creando regla:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error creando regla.",
    });
  }
});

router.patch("/:id", express.json(), async (req, res) => {
  try {
    const row = await updateBankClassificationRule(req.params.id, req.body || {});
    return res.json({ success: true, data: row });
  } catch (error) {
    console.error("❌ Error actualizando regla:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error actualizando regla.",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await deleteBankClassificationRule(req.params.id);
    return res.json({ success: true, message: "Regla eliminada." });
  } catch (error) {
    console.error("❌ Error eliminando regla:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error eliminando regla.",
    });
  }
});

export default router;
