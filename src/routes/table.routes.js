import { Router } from "express";
import {
  getTables,
  getTableById,
  createTable,
  updateTable,
  deleteTable,
} from "../controllers/table.controller.js";

const router = Router();

router.get("/", getTables);
router.get("/:id", getTableById);
router.post("/", createTable);
router.put("/:id", updateTable);
router.delete("/:id", deleteTable);

export default router;
