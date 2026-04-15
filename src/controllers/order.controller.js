import pool from "../config/db.js";

const validPaymentMethods = ["cash", "qris", "card", "transfer"];

export const getOrders = async (req, res) => {
  try {
    const { status, table_id } = req.query;

    let sql = `
      SELECT 
        o.id, o.table_id, o.status, o.total, o.discount, o.tax,
        o.payment_method, o.payment_amount,
        o.created_at, o.paid_at, o.customer_name,
        t.name AS table_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id, 
              'menu_id', oi.menu_id, 
              'menu_name', m.name,
              'qty', oi.qty, 
              'price', oi.price, 
              'subtotal', oi.subtotal
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM orders o
      LEFT JOIN tables t ON t.id = o.table_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN menus m ON m.id = oi.menu_id
    `;

    const params = [];
    let paramIndex = 1;

    if (status) {
      sql += ` WHERE o.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (table_id) {
      const whereClause = sql.includes("WHERE") ? " AND" : " WHERE";
      sql += ` ${whereClause} o.table_id = $${paramIndex}`;
      params.push(table_id);
    }

    sql += ` GROUP BY o.id, t.name ORDER BY o.created_at DESC`;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: orderRows } = await pool.query(
      `SELECT o.*, t.name AS table_name FROM orders o LEFT JOIN tables t ON t.id = o.table_id WHERE o.id = $1`,
      [id],
    );

    if (!orderRows.length)
      return res.status(404).json({ message: "Order not found" });

    const order = orderRows[0];
    const { rows: items } = await pool.query(
      `SELECT oi.*, m.name AS menu_name FROM order_items oi JOIN menus m ON m.id = oi.menu_id WHERE oi.order_id = $1`,
      [id],
    );

    res.json({ ...order, items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    const { table_id, items, customer_name, discount, tax, payment_method } =
      req.body;

    if (!items?.length)
      return res.status(400).json({ message: "Items required" });
    if (payment_method && !validPaymentMethods.includes(payment_method)) {
      return res.status(400).json({
        message: `Invalid payment_method. Allowed: ${validPaymentMethods.join(", ")}`,
      });
    }

    await client.query("BEGIN");

    const orderRes = await client.query(
      `INSERT INTO orders (table_id, status, customer_name, discount, tax, payment_method) 
       VALUES ($1, 'open', $2, $3, $4, $5) RETURNING *`,
      [
        table_id,
        customer_name || null,
        discount || 0,
        tax || 0,
        payment_method || null,
      ],
    );
    const order = orderRes.rows[0];

    let total = 0;
    for (const item of items) {
      const { menu_id, qty } = item;
      const menuRes = await client.query(
        "SELECT price, stock FROM menus WHERE id = $1 AND is_active = true",
        [menu_id],
      );

      if (!menuRes.rows.length) throw new Error(`Menu ${menu_id} not found`);
      if (menuRes.rows[0].stock < qty) throw new Error(`Insufficient stock`);

      const { price } = menuRes.rows[0];
      const subtotal = price * qty;
      total += subtotal;

      await client.query(
        `INSERT INTO order_items (order_id, menu_id, qty, price, subtotal) VALUES ($1, $2, $3, $4, $5)`,
        [order.id, menu_id, qty, price, subtotal],
      );

      await client.query("UPDATE menus SET stock = stock - $1 WHERE id = $2", [
        qty,
        menu_id,
      ]);
    }

    const updateOrderRes = await client.query(
      "UPDATE orders SET total = $1 WHERE id = $2 RETURNING *",
      [total, order.id],
    );

    await client.query("UPDATE tables SET status = $1 WHERE id = $2", [
      "occupied",
      table_id,
    ]);
    await client.query("COMMIT");

    res.status(201).json(updateOrderRes.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
};

export const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, discount, tax, payment_method } = req.body;

    if (payment_method && !validPaymentMethods.includes(payment_method)) {
      return res.status(400).json({
        message: `Invalid payment_method. Allowed: ${validPaymentMethods.join(", ")}`,
      });
    }

    const { rows } = await pool.query(
      `UPDATE orders SET 
         status = COALESCE($1, status),
         discount = COALESCE($2, discount),
         tax = COALESCE($3, tax),
         payment_method = COALESCE($4, payment_method)
       WHERE id = $5 RETURNING *`,
      [status, discount, tax, payment_method, id],
    );

    if (!rows.length)
      return res.status(404).json({ message: "Order not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const payOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { payment_method, payment_amount } = req.body;

    if (!payment_method || !payment_amount) {
      return res
        .status(400)
        .json({ message: "payment_method & payment_amount required" });
    }
    if (!validPaymentMethods.includes(payment_method)) {
      return res.status(400).json({
        message: `Invalid payment_method. Allowed: ${validPaymentMethods.join(", ")}`,
      });
    }

    await client.query("BEGIN");

    const { rows } = await client.query(
      `UPDATE orders SET 
         status = 'paid', paid_at = NOW(),
         payment_method = $1, payment_amount = $2
       WHERE id = $3 AND status != 'paid' RETURNING *`,
      [payment_method, payment_amount, id],
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ message: "Order not found or already paid" });
    }

    await client.query("UPDATE tables SET status = $1 WHERE id = $2", [
      "available",
      rows[0].table_id,
    ]);
    await client.query("COMMIT");

    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};

export const cancelOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT table_id FROM orders WHERE id = $1 AND status = $2",
      [id, "open"],
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Open order not found" });
    }

    await client.query("UPDATE orders SET status = $1 WHERE id = $2", [
      "canceled",
      id,
    ]);
    await client.query("UPDATE tables SET status = $1 WHERE id = $2", [
      "available",
      rows[0].table_id,
    ]);

    // Restore stock
    await client.query(
      `
      UPDATE menus m SET stock = m.stock + oi.qty
      FROM order_items oi WHERE oi.menu_id = m.id AND oi.order_id = $1
    `,
      [id],
    );

    await client.query("COMMIT");
    res.json({ message: "Order canceled" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};
