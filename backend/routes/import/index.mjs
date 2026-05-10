console.log("🟢 import/index.mjs cargado");
import express from "express";

const router = express.Router();

/* ============================================================
   IMPORTACIÓN DE SUBRUTAS
============================================================ */
import uploadRoutes from "./upload.routes.mjs";
import translateRoutes from "./translate.routes.mjs";
import normalizeRoutes from "./normalize.routes.mjs";
import mapNormalizedRoutes from "./map-normalized.routes.mjs";
import batchesRoutes from "./batches.routes.mjs";
import mappedBatchesRoutes from "./mapped-batches.routes.mjs";
import reviewRoutes from "./review.routes.mjs";
import mapRoutes from "./map.routes.mjs";
import classifyRoutes from "./classify.routes.mjs";
import taxonomyRoutes from "./taxonomy.routes.mjs";
import auditRoutes from "./audit.routes.mjs";

/* ============================================================
   MONTAJE DE SUBROUTERS
============================================================ */

// Upload + Translate + Normalize + Map
router.use("/", uploadRoutes);
router.use("/", translateRoutes);
router.use("/", batchesRoutes);
router.use("/", normalizeRoutes);
router.use("/", mapNormalizedRoutes);

// Review
router.use("/", reviewRoutes);
router.use("/", mappedBatchesRoutes);

// IA pesada
router.use("/", mapRoutes);

router.use("/", auditRoutes);

// Clasificación automática
router.use("/", classifyRoutes);

// Taxonomía
router.use("/", taxonomyRoutes);

export default router;
