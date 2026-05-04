import pool from "../config/db.js";

export const getFloors = async (req, res) => {
  try {
    const { is_active } = req.query;

    let sql = `
      SELECT 
        f.*,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id',       t.id,
              'name',     t.name,
              'capacity', t.capacity,
              'status',   t.status,
              'floor_id', t.floor_id
            ) ORDER BY t.id
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) AS tables
      FROM floors f
      LEFT JOIN tables t ON t.floor_id = f.id
    `;

    const params = [];
    if (is_active !== undefined) {
      params.push(is_active === "true");
      sql += ` WHERE f.is_active = $1`;
    }

    sql += ` GROUP BY f.id ORDER BY f.id`;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getFloorById = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `
      SELECT 
        f.*,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id',       t.id,
              'name',     t.name,
              'capacity', t.capacity,
              'status',   t.status,
              'floor_id', t.floor_id
            ) 
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) AS tables
      FROM floors f
      LEFT JOIN tables t ON t.floor_id = f.id
      WHERE f.id = $1
      GROUP BY f.id
      `,
      [id],
    );

    if (!rows.length)
      return res.status(404).json({ message: "Floor not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createFloor = async (req, res) => {
  try {
    const { name, is_active } = req.body;

    if (!name) return res.status(400).json({ message: "Name is required" });

    const { rows } = await pool.query(
      `INSERT INTO floors (name, is_active)
       VALUES ($1, $2)
       RETURNING *`,
      [name, is_active ?? true],
    );

    res.status(201).json({ ...rows[0], tables: [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateFloor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;

    const { rows } = await pool.query(
      `UPDATE floors
       SET
         name      = COALESCE($1, name),
         is_active = COALESCE($2, is_active)
       WHERE id = $3
       RETURNING *`,
      [
        name || null,
        is_active !== undefined
          ? is_active === "false"
            ? false
            : Boolean(is_active)
          : null,
        id,
      ],
    );

    if (!rows.length)
      return res.status(404).json({ message: "Floor not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteFloor = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows: tables } = await pool.query(
      `SELECT id FROM tables WHERE floor_id = $1 LIMIT 1`,
      [id],
    );

    if (tables.length) {
      return res.status(400).json({
        message:
          "Floor masih memiliki meja, pindahkan atau hapus meja terlebih dahulu",
      });
    }

    const { rowCount } = await pool.query(`DELETE FROM floors WHERE id = $1`, [
      id,
    ]);

    if (!rowCount) return res.status(404).json({ message: "Floor not found" });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
