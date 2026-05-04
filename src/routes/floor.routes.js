import { Router } from "express";
import {
  createFloor,
  deleteFloor,
  getFloorById,
  getFloors,
  updateFloor,
} from "../controllers/floor.controller.js";

const router = Router();

router.get("/", getFloors);
router.get("/:id", getFloorById);
router.post("/", createFloor);
router.put("/:id", updateFloor);
router.delete("/:id", deleteFloor);

export default router;
