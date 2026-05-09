import pool from "../config/db.js";
import { generateOrderNumber } from "../utils/index.js";

const validPaymentMethods = ["cash", "qris"];

const getOrderQuery = `
  SELECT
    o.*,
    t.name AS table_name,
    f.name AS floor_name,
    COALESCE(
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'item_id',    oi.id,
          'menu_id',    oi.menu_id,
          'menu_name',  oi.menu_name,
          'menu_image', oi.menu_image,
          'menu_price', oi.menu_price::float,
          'qty',        oi.qty,
          'note',       oi.note,
          'subtotal',   oi.subtotal::float
        ) ORDER BY oi.id
      ) FILTER (WHERE oi.id IS NOT NULL),
      '[]'
    ) AS order_items
  FROM orders o
  LEFT JOIN tables t ON t.id = o.table_id
  LEFT JOIN floors f ON t.floor_id = f.id
  LEFT JOIN order_items oi ON oi.order_id = o.id
`;

const formatOrder = (row) => ({
  order_id: row.id,
  order_number: row.order_number,
  order_type: row.order_type,
  order_status: row.status,
  order_table_id: row.table_id,
  order_table: row.table_name,
  order_floor: row.floor_name,
  order_customer: row.customer_name,
  order_subtotal: parseFloat(row.order_subtotal),
  order_tax: parseFloat(row.tax),
  order_discount: parseFloat(row.discount),
  order_total: parseFloat(row.total),
  order_items: row.order_items,
  payments: row.payments,
  created_at: row.created_at,
  paid_at: row.paid_at,
});

// ─── Controllers ──────────────────────────────────────────────────────────────

export const getOrders = async (req, res) => {
  try {
    const { status, order_type, table_id } = req.query;

    const params = [];
    const conditions = [];

    if (status) {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }
    if (order_type) {
      params.push(order_type);
      conditions.push(`o.order_type = $${params.length}`);
    }
    if (table_id) {
      params.push(parseInt(table_id));
      conditions.push(`o.table_id = $${params.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const { rows } = await pool.query(
      `${getOrderQuery} ${whereClause} GROUP BY o.id, t.name, f.name ORDER BY o.created_at DESC`,
      params,
    );

    res.json(rows.map(formatOrder));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `${getOrderQuery} WHERE o.id = $1 GROUP BY o.id, t.name`,
      [id],
    );
    if (!rows.length)
      return res.status(404).json({ message: "Order not found" });
    res.json(formatOrder(rows[0]));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getOrderNumber = async (req, res) => {
  try {
    const client = await pool.connect();

    const order_number = await generateOrderNumber(client);

    res.json({ order_number });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      order_table_id,
      order_customer,
      order_type = "POS",
      order_items,
      order_subtotal = 0,
      order_tax = 0,
      order_discount = 0,
      order_total = 0,
    } = req.body;

    if (!order_items?.length) {
      return res
        .status(400)
        .json({ message: "Order items tidak boleh kosong" });
    }

    await client.query("BEGIN");

    const order_number = await generateOrderNumber(client);

    // Insert order dulu
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (order_number, table_id, customer_name, order_type, order_subtotal, tax, discount, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        order_number,
        order_table_id || null,
        order_customer || "",
        order_type,
        order_subtotal,
        order_tax,
        order_discount,
        order_total,
      ],
    );

    const orderId = orderRows[0].id;

    // Insert order_items + kurangi stok
    for (const item of order_items) {
      const { rows: menuRows } = await client.query(
        `SELECT id, name, price, image_url, stock FROM menus WHERE id = $1 AND is_active = true`,
        [item.menu_id],
      );

      if (!menuRows.length)
        throw new Error(
          `Menu ${item.menu_name ?? item.menu_id} tidak ditemukan`,
        );
      if (menuRows[0].stock < item.quantity)
        throw new Error(`Stok ${menuRows[0].name} tidak cukup`);

      const menu = menuRows[0];

      await client.query(
        `INSERT INTO order_items (order_id, menu_id, menu_name, menu_price, menu_image, category_id, qty, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          orderId,
          menu.id,
          menu.name,
          menu.price,
          menu.image_url || null,
          item.category_id || null,
          item.quantity,
          item.note || null,
        ],
      );

      await client.query(`UPDATE menus SET stock = stock - $1 WHERE id = $2`, [
        item.quantity,
        menu.id,
      ]);
    }

    await client.query("COMMIT");

    // Fetch ulang dengan format lengkap
    const { rows } = await pool.query(
      `${getOrderQuery} WHERE o.id = $1 GROUP BY o.id, t.name`,
      [orderId],
    );

    res.status(201).json(formatOrder(rows[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatus = ["pending", "completed", "cancelled"];
    if (!validStatus.includes(status)) {
      return res.status(400).json({
        message: `Status tidak valid. Pilihan: ${validStatus.join(", ")}`,
      });
    }

    const { rows } = await pool.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id],
    );

    if (!rows.length)
      return res.status(404).json({ message: "Order not found" });

    const { rows: updated } = await pool.query(
      `${getOrderQuery} WHERE o.id = $1 GROUP BY o.id, t.name`,
      [id],
    );

    res.json(formatOrder(updated[0]));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const cancelOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const { rows: existing } = await client.query(
      `SELECT * FROM orders WHERE id = $1`,
      [id],
    );

    if (!existing.length)
      return res.status(404).json({ message: "Order not found" });
    if (existing[0].status === "completed") {
      return res
        .status(400)
        .json({ message: "Order yang sudah completed tidak bisa dibatalkan" });
    }

    await client.query("BEGIN");

    // Restore stok
    await client.query(
      `UPDATE menus m SET stock = m.stock + oi.qty
       FROM order_items oi
       WHERE oi.menu_id = m.id AND oi.order_id = $1`,
      [id],
    );

    await client.query(`UPDATE orders SET status = 'cancelled' WHERE id = $1`, [
      id,
    ]);

    await client.query("COMMIT");

    const { rows } = await pool.query(
      `${getOrderQuery} WHERE o.id = $1 GROUP BY o.id, t.name`,
      [id],
    );

    res.json(formatOrder(rows[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};
