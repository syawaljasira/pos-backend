import { Router } from "express";
import {
  getMenus,
  getMenuById,
  createMenu,
  updateMenu,
  deleteMenu,
} from "../controllers/menu.controller.js";
import { upload } from "../config/cloudinary.js";

const router = Router();

// upload.single("image") → nama field form-data harus "image"
router.get("/", getMenus);
router.get("/:id", getMenuById);
router.post("/", upload.single("image"), createMenu);
router.put("/:id", upload.single("image"), updateMenu);
router.delete("/:id", deleteMenu);

export default router;
