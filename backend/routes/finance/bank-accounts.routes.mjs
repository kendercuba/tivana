import express from "express";
import {
  listBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
} from "../../finance/services/bankAccountsService.mjs";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const includeInactive = req.query.all === "1" || req.query.all === "true";
    const rows = await listBankAccounts({ includeInactive });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Error listando cuentas bancarias:", error);
    return res.status(500).json({
      success: false,
      message: "Error listando cuentas.",
      error: error.message,
    });
  }
});

router.post("/", express.json(), async (req, res) => {
  try {
    const { name, notes, bnc_last_four } = req.body || {};
    const row = await createBankAccount({ name, notes, bnc_last_four });
    return res.status(201).json({ success: true, data: row });
  } catch (error) {
    console.error("❌ Error creando cuenta:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error creando cuenta.",
    });
  }
});

router.patch("/:id", express.json(), async (req, res) => {
  try {
    const id = req.params.id;
    const { name, notes, is_active, sort_order, bnc_last_four } =
      req.body || {};
    const row = await updateBankAccount(id, {
      name,
      notes,
      is_active,
      sort_order,
      bnc_last_four,
    });
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Cuenta no encontrada.",
      });
    }
    return res.json({ success: true, data: row });
  } catch (error) {
    console.error("❌ Error actualizando cuenta:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error actualizando cuenta.",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const ok = await deleteBankAccount(id);
    if (!ok) {
      return res.status(404).json({
        success: false,
        message: "Cuenta no encontrada.",
      });
    }
    return res.json({ success: true, message: "Cuenta eliminada." });
  } catch (error) {
    console.error("❌ Error eliminando cuenta:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error eliminando cuenta.",
    });
  }
});

export default router;
