import { Router } from "express";
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  getOrderNumber,
} from "../controllers/order.controller.js";

const router = Router();

router.get("/order-number", getOrderNumber);
router.get("/", getOrders); // ?status=open&table_id=1
router.get("/:id", getOrderById);
router.post("/", createOrder);
router.patch("/:id/status", updateOrderStatus);
router.patch("/:id/cancel", cancelOrder); // atau POST /:id/cancel

export default router;
