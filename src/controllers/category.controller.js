import pool from "../config/db.js";

export const getCategories = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM categories ORDER BY id");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const rows = await pool.query("SELECT * FROM categories WHERE id = $1", [
      id,
    ]);

    if (!rows.length) return res.status(404).json({ message: "Not Found" });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    const rows = await pool.query(
      "INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *",
      [name, description || null],
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const { rows } = await pool.query(
      `UPDATE categories 
       SET name = $1, description = $2 
       WHERE id = $3 
       RETURNING *`,
      [name, description, id],
    );

    if (!rows.length) return res.status(404).json({ message: "Not Found" });

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query(
      "DELETE FROM categories WHERE id = $1",
      [id],
    );
    if (!rowCount) return res.status(404).json({ message: "Not Found" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
