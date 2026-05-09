import pool from "../config/db.js";

export const createPayment = async (req, res) => {
  const client = await pool.connect();
  try {
    const { order_id, payment_method, amount, expired_at } = req.body;

    if (!order_id || !payment_method || !amount) {
      return res
        .status(400)
        .json({ message: "order_id, payment_method, amount wajib diisi" });
    }

    const validMethods = ["cash", "qris"];
    if (!validMethods.includes(payment_method)) {
      return res
        .status(400)
        .json({ message: "payment_method harus cash atau qris" });
    }

    // Cek order exist dan belum cancelled
    const { rows: orderRows } = await pool.query(
      `SELECT * FROM orders WHERE id = $1`,
      [order_id],
    );
    if (!orderRows.length)
      return res.status(404).json({ message: "Order not found" });
    if (orderRows[0].status === "cancelled") {
      return res.status(400).json({ message: "Order sudah dibatalkan" });
    }

    // Cek belum ada payment success
    const { rows: existingPayment } = await pool.query(
      `SELECT id FROM payments WHERE order_id = $1 AND status = 'success'`,
      [order_id],
    );
    if (existingPayment.length) {
      return res.status(400).json({ message: "Order sudah lunas" });
    }

    await client.query("BEGIN");

    // Cash → langsung success
    // QRIS → pending dulu, konfirmasi manual via PATCH /:id/confirm
    const status = payment_method === "cash" ? "success" : "pending";
    const paid_at = payment_method === "cash" ? "NOW()" : null;

    const { rows: paymentRows } = await client.query(
      `INSERT INTO payments (order_id, payment_method, amount, status, expired_at, paid_at)
       VALUES ($1, $2, $3, $4, $5, ${paid_at ? "NOW()" : "NULL"})
       RETURNING *`,
      [order_id, payment_method, amount, status, expired_at || null],
    );

    // Kalau cash → langsung update order paid_at + completed
    if (payment_method === "cash") {
      await client.query(
        `UPDATE orders SET paid_at = NOW(), status = 'completed' WHERE id = $1`,
        [order_id],
      );
    }

    await client.query("COMMIT");

    res.status(201).json(paymentRows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};

export const confirmPayment = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const { rows: paymentRows } = await pool.query(
      `SELECT * FROM payments WHERE id = $1`,
      [id],
    );
    if (!paymentRows.length)
      return res.status(404).json({ message: "Payment not found" });
    if (paymentRows[0].status === "success") {
      return res.status(400).json({ message: "Payment sudah dikonfirmasi" });
    }
    if (paymentRows[0].status === "expired") {
      return res
        .status(400)
        .json({ message: "Payment sudah expired, buat payment baru" });
    }

    await client.query("BEGIN");

    const { rows: updated } = await client.query(
      `UPDATE payments SET status = 'success', paid_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );

    // Update order paid_at + completed
    await client.query(
      `UPDATE orders SET paid_at = NOW(), status = 'completed' WHERE id = $1`,
      [paymentRows[0].order_id],
    );

    await client.query("COMMIT");

    res.json(updated[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};

export const expirePayment = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `UPDATE payments SET status = 'expired' WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id],
    );

    if (!rows.length) {
      return res
        .status(400)
        .json({ message: "Payment not found atau sudah tidak pending" });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getPaymentByOrder = async (req, res) => {
  try {
    const { order_id } = req.params;

    const { rows } = await pool.query(
      `SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC`,
      [order_id],
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
