import { Router } from "express";
import {
  createPayment,
  confirmPayment,
  expirePayment,
  getPaymentByOrder,
} from "../controllers/payment.controller.js";

const router = Router();

router.get("/order/:order_id", getPaymentByOrder);
router.post("/", createPayment);
router.patch("/:id/confirm", confirmPayment); // kasir konfirmasi QRIS manual
router.patch("/:id/expire", expirePayment); // expire QRIS yang tidak jadi bayar

export default router;
