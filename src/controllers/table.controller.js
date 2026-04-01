import pool from "../config/db.js";

export const getTables = async (req, res) => {
  try {
    const { status } = req.query;

    let sql = `SELECT * FROM tables`;
    const params = [];

    if (status) {
      params.push(status);
      sql += ` WHERE status = $1`;
    }

    sql += ` ORDER BY id DESC`;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getTableById = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(`SELECT * FROM tables WHERE id = $1`, [
      id,
    ]);
    if (!rows.length) return res.status(404).json({ message: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createTable = async (req, res) => {
  try {
    const { name, capacity, status } = req.body;

    const { rows } = await pool.query(
      `
      INSERT INTO tables (name, capacity, status)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [name, capacity, status || "available"],
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateTable = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, capacity, status } = req.body;

    const { rows } = await pool.query(
      `
      UPDATE tables
      SET name = $1, capacity = $2, status = $3
      WHERE id = $4
      RETURNING *
      `,
      [name, capacity, status, id],
    );

    if (!rows.length) return res.status(404).json({ message: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteTable = async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query("DELETE FROM tables WHERE id = $1", [
      id,
    ]);
    if (!rowCount) return res.status(404).json({ message: "Not found" });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
