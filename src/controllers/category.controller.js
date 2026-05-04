import pool from "../config/db.js";

export const getCategories = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM categories ORDER BY id");
    res.json({
      status: 200,
      message: "Success to retrieve the categories.",
      data: rows,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      "SELECT * FROM categories WHERE id = $1",
      [id],
    );

    if (!rows.length) return res.status(404).json({ message: "Not Found" });

    res.json({
      status: 200,
      message: "Success to retrieve the category details.",
      data: rows[0],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, description, icon, is_active } = req.body;

    const { rows } = await pool.query(
      "INSERT INTO categories (name, description, icon, is_active) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, description || null, icon || null, is_active],
    );

    res.json({
      status: 201,
      message: "Success to create new category.",
      data: rows[0],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, is_active } = req.body;

    if (typeof is_active === "boolean" && !name) {
      const { rows } = await pool.query(
        `UPDATE categories 
       SET is_active = $1 
       WHERE id = $2 
       RETURNING *`,
        [is_active, id],
      );

      if (!rows.length) return res.status(404).json({ message: "Not Found" });

      return res.json({
        status: 200,
        message: rows[0]?.is_active
          ? "Success to activated the category."
          : "Success to non-active the category.",
        data: rows[0],
      });
    }

    const { rows } = await pool.query(
      `UPDATE categories 
       SET name = $1, description = $2, icon = $3 
       WHERE id = $4 
       RETURNING *`,
      [name, description, icon, id],
    );

    if (!rows.length) return res.status(404).json({ message: "Not Found" });

    res.json({
      status: 200,
      message: "Success to update the category.",
      data: rows[0],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows, rowCount } = await pool.query(
      "DELETE FROM categories WHERE id = $1 RETURNING *",
      [id],
    );
    if (!rowCount) return res.status(404).json({ message: "Not Found" });

    res.json({
      status: 204,
      message: "Success to delete category.",
      data: rows[0],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
