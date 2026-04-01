import pool from "../config/db.js";

export const getMenus = async (req, res) => {
  try {
    const { category_id } = req.query;

    let sql = `
      SELECT 
        m.*,
        c.name AS category_name
      FROM menus m
      LEFT JOIN categories c ON c.id = m.category_id
    `;
    const params = [];

    if (category_id) {
      params.push(category_id);
      sql += ` WHERE m.category_id = $1`;
    }

    sql += ` ORDER BY m.id DESC`;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getMenuById = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `
      SELECT 
        m.*,
        c.name AS category_name
      FROM menus m
      LEFT JOIN categories c ON c.id = m.category_id
      WHERE m.id = $1
      `,
      [id],
    );

    if (!rows.length) return res.status(404).json({ message: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createMenu = async (req, res) => {
  try {
    const {
      category_id,
      name,
      description,
      price,
      stock,
      image_url,
      is_active,
    } = req.body;

    const { rows } = await pool.query(
      `
      INSERT INTO menus (category_id, name, description, price, stock, image_url, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        category_id || null,
        name,
        description || null,
        price,
        stock ?? 0,
        image_url || null,
        is_active ?? true,
      ],
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      category_id,
      name,
      description,
      price,
      stock,
      image_url,
      is_active,
    } = req.body;

    const { rows } = await pool.query(
      `
      UPDATE menus
      SET 
        category_id = $1,
        name = $2,
        description = $3,
        price = $4,
        stock = $5,
        image_url = $6,
        is_active = $7
      WHERE id = $8
      RETURNING *
      `,
      [
        category_id || null,
        name,
        description || null,
        price,
        stock ?? 0,
        image_url || null,
        is_active ?? true,
        id,
      ],
    );

    if (!rows.length) return res.status(404).json({ message: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query("DELETE FROM menus WHERE id = $1", [
      id,
    ]);
    if (!rowCount) return res.status(404).json({ message: "Not found" });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
