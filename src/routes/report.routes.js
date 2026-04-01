import { Router } from "express";
import {
  getDailyReport,
  getMonthlyReport,
  getTopMenuReport,
} from "../controllers/report.controller.js";

const router = Router();

router.get("/daily", getDailyReport);
router.get("/monthly", getMonthlyReport);
router.get("/top-menu", getTopMenuReport);

export default router;
