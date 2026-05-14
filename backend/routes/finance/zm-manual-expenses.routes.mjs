import express from "express";
import {
  listManualExpenses,
  createManualExpense,
  updateManualExpense,
  deleteManualExpense,
  getManualExpenseById,
  tryMatchManualExpense,
} from "../../finance/services/zmManualExpensesService.mjs";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const month = req.query.month || null;
    const rows = await listManualExpenses({ monthYyyyMm: month });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Error listando gastos manuales:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error cargando gastos.",
      error: error.message,
    });
  }
});

router.post("/", express.json(), async (req, res) => {
  try {
    const row = await createManualExpense(req.body || {});
    return res.status(201).json({ success: true, data: row });
  } catch (error) {
    console.error("❌ Error creando gasto manual:", error);
    const status = /inválid|obligator|no válid/i.test(error.message || "")
      ? 400
      : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Error guardando gasto.",
      error: error.message,
    });
  }
});

router.patch("/:id", express.json(), async (req, res) => {
  try {
    const row = await updateManualExpense(req.params.id, req.body || {});
    return res.json({ success: true, data: row });
  } catch (error) {
    console.error("❌ Error actualizando gasto manual:", error);
    const status = /no encontrad/i.test(error.message || "") ? 404 : 400;
    return res.status(status).json({
      success: false,
      message: error.message || "Error actualizando gasto.",
      error: error.message,
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await deleteManualExpense(req.params.id);
    return res.json({ success: true, message: "Gasto eliminado." });
  } catch (error) {
    console.error("❌ Error eliminando gasto manual:", error);
    const status = /no encontrad/i.test(error.message || "") ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Error eliminando gasto.",
      error: error.message,
    });
  }
});

router.post("/:id/rematch", async (req, res) => {
  try {
    const row = await tryMatchManualExpense(req.params.id);
    return res.json({ success: true, data: row });
  } catch (error) {
    console.error("❌ Error re-emparejando gasto:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error re-emparejando.",
      error: error.message,
    });
  }
});

export default router;
