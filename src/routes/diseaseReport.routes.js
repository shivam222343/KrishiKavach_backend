import express from "express";
import { createReport, getFarmerReports, markReportTreated, detectDiseaseML, identifyCropML, deleteReport } from "../controllers/diseaseReport.controller.js";
import { protect, authorizeRoles } from "../middleware/auth.middleware.js";
import { uploadMultiple, uploadSingle } from "../middleware/upload.middleware.js";

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("farmer"));

router.post("/", uploadMultiple("images"), createReport);
router.post("/detect", uploadSingle("file"), detectDiseaseML);
router.post("/identify-crop", uploadSingle("file"), identifyCropML);
router.get("/", getFarmerReports);
router.put("/:id/mark-treated", markReportTreated);
router.delete("/:id", deleteReport);

export default router;
