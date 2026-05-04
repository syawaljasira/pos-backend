import pool from "../config/db.js";

export const getTables = async (req, res) => {
  try {
    const { floor_id, status } = req.query;

    const params = [];
    const conditions = [];

    if (floor_id) {
      params.push(parseInt(floor_id));
      conditions.push(`t.floor_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`t.status = $${params.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ` + conditions.join(" AND ")
      : "";

    const sql = `
      SELECT
        floor_id,
        floor_name,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'capacity', capacity,
            'tables',   tables
          ) ORDER BY capacity
        ) AS tables_by_capacity
      FROM (
        SELECT
          f.id   AS floor_id,
          f.name AS floor_name,
          t.capacity,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id',     t.id,
              'name',   t.name,
              'status', t.status
            ) ORDER BY t.id
          ) FILTER (WHERE t.id IS NOT NULL) AS tables
        FROM floors f
        LEFT JOIN tables t ON t.floor_id = f.id
        ${whereClause}
        GROUP BY f.id, f.name, t.capacity
      ) grouped
      GROUP BY floor_id, floor_name
      ORDER BY floor_id
    `;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

[
  {
    capacity: 2,
    floor_id: 1,
    tables: [{ id: 1, name: "Meja 1", status: "available" }],
  },
];

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
    const { floor_id, name, capacity, status } = req.body;

    if (!name) return res.status(400).json({ message: "Name is required" });
    if (!floor_id)
      return res.status(400).json({ message: "Floor is required" });

    // Cek floor exist
    const floor = await pool.query(`SELECT id FROM floors WHERE id = $1`, [
      floor_id,
    ]);
    if (!floor.rows.length) {
      return res.status(404).json({ message: "Floor not found" });
    }

    const { rows } = await pool.query(
      `INSERT INTO tables (floor_id, name, capacity, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        parseInt(floor_id),
        name,
        capacity ? parseInt(capacity) : null,
        status || "available",
      ],
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateTable = async (req, res) => {
  try {
    const { id } = req.params;
    const { floor_id, name, capacity, status } = req.body;

    // Kalau pindah floor, cek floor tujuan exist
    if (floor_id) {
      const floor = await pool.query(`SELECT id FROM floors WHERE id = $1`, [
        floor_id,
      ]);
      if (!floor.rows.length) {
        return res.status(404).json({ message: "Floor not found" });
      }
    }

    const { rows } = await pool.query(
      `UPDATE tables
       SET
         floor_id = COALESCE($1, floor_id),
         name     = COALESCE($2, name),
         capacity = COALESCE($3, capacity),
         status   = COALESCE($4, status)
       WHERE id = $5
       RETURNING *`,
      [
        floor_id ? parseInt(floor_id) : null,
        name || null,
        capacity ? parseInt(capacity) : null,
        status || null,
        id,
      ],
    );

    if (!rows.length) return res.status(404).json({ message: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateTableStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatus = ["available", "occupied", "reserved"];
    if (!validStatus.includes(status)) {
      return res.status(400).json({ message: "Status tidak valid" });
    }

    const { rows } = await pool.query(
      `UPDATE tables SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id],
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
    const { rowCount } = await pool.query(`DELETE FROM tables WHERE id = $1`, [
      id,
    ]);
    if (!rowCount) return res.status(404).json({ message: "Not found" });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
