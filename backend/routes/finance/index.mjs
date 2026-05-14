import express from "express";
import bankRoutes from "./bank.routes.mjs";
import bankAccountsRoutes from "./bank-accounts.routes.mjs";
import loyverseRoutes from "./loyverse.routes.mjs";
import dailyCloseRoutes from "./daily-close.routes.mjs";
import dashboardRoutes from "./dashboard.routes.mjs";
import categoriesRoutes from "./categories.routes.mjs";
import classificationRulesRoutes from "./classification-rules.routes.mjs";
import purchaseOrdersRoutes from "./purchase-orders.routes.mjs";
import zmWeeklyOverviewRoutes from "./zm-weekly-overview.routes.mjs";
import reportingGapsRoutes from "./reporting-gaps.routes.mjs";
import zmManualExpensesRoutes from "./zm-manual-expenses.routes.mjs";
import loyverseBankReconciliationRoutes from "./loyverse-bank-reconciliation.routes.mjs";
import reconciliationRoutes from "./reconciliation.routes.mjs";

const router = express.Router();

router.get("/ping", (req, res) => {
  res.json({
    ok: true,
    service: "finance",
    routes: [
      "bank-accounts",
      "bank",
      "loyverse",
      "purchase-orders",
      "categories",
      "classification-rules",
      "zm-weekly-overview",
      "reporting-gaps",
      "zm-manual-expenses",
      "loyverse-bank-reconciliation",
      "reconciliation",
    ],
  });
});

router.use("/bank-accounts", bankAccountsRoutes);
router.use("/bank", bankRoutes);
router.use("/categories", categoriesRoutes);
router.use("/classification-rules", classificationRulesRoutes);
router.use("/loyverse", loyverseRoutes);
router.use("/purchase-orders", purchaseOrdersRoutes);
router.use("/zm-weekly-overview", zmWeeklyOverviewRoutes);
router.use("/reporting-gaps", reportingGapsRoutes);
router.use("/zm-manual-expenses", zmManualExpensesRoutes);
router.use(
  "/loyverse-bank-reconciliation",
  loyverseBankReconciliationRoutes
);
router.use("/reconciliation", reconciliationRoutes);
router.use("/daily-close", dailyCloseRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;