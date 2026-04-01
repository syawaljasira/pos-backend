import { Router } from "express";
import {
  getMenus,
  getMenuById,
  createMenu,
  updateMenu,
  deleteMenu,
} from "../controllers/menu.controller.js";

const router = Router();

router.get("/", getMenus);
router.get("/:id", getMenuById);
router.post("/", createMenu);
router.put("/:id", updateMenu);
router.delete("/:id", deleteMenu);

export default router;
