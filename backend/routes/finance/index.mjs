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
router.use("/daily-close", dailyCloseRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;