import { Router } from "express";
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  payOrder,
  cancelOrder,
} from "../controllers/order.controller.js";

const router = Router();

router.get("/", getOrders); // ?status=open&table_id=1
router.get("/:id", getOrderById);
router.post("/", createOrder);
router.put("/:id", updateOrder);
router.post("/:id/pay", payOrder);
router.delete("/:id", cancelOrder); // atau POST /:id/cancel

export default router;
