import pool from "../config/db.js";

export const getDailyReport = async (req, res) => {
  try {
    const { date } = req.query;

    const { rows } = await pool.query(
      `
      SELECT
        DATE(o.paid_at) AS report_date,
        COUNT(DISTINCT o.id) AS total_orders,
        SUM(o.total) AS total_sales
      FROM orders o
      WHERE o.status = 'paid'
        AND DATE(o.paid_at) = COALESCE($1::date, CURRENT_DATE)
      GROUP BY DATE(o.paid_at)
      `,
      [date || null],
    );

    res.json(
      rows[0] || { report_date: date || null, total_orders: 0, total_sales: 0 },
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getMonthlyReport = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        TO_CHAR(DATE_TRUNC('month', o.paid_at), 'YYYY-MM') AS month,
        COUNT(DISTINCT o.id) AS total_orders,
        SUM(o.total) AS total_sales
      FROM orders o
      WHERE o.status = 'paid'
        AND o.paid_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
      GROUP BY DATE_TRUNC('month', o.paid_at)
      ORDER BY DATE_TRUNC('month', o.paid_at)
      `,
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getTopMenuReport = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        m.id,
        m.name,
        SUM(oi.qty) AS total_qty,
        SUM(oi.subtotal) AS total_sales
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN menus m ON m.id = oi.menu_id
      WHERE o.status = 'paid'
        AND o.paid_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY m.id, m.name
      ORDER BY total_qty DESC
      LIMIT 10
      `,
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
