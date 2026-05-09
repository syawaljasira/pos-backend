import pool from "../config/db.js";
import cloudinary from "../config/cloudinary.js";

export const getMenus = async (req, res) => {
  try {
    const { cat } = req.query;

    let sql = `
      SELECT 
        m.*,
        c.name AS category_name
      FROM menus m
      LEFT JOIN categories c ON c.id = m.category_id
    `;
    const params = [];

    if (cat) {
      params.push(cat);
      sql += ` WHERE m.category_id = $1`;
    }

    sql += ` ORDER BY m.id DESC`;

    const { rows } = await pool.query(sql, params);

    // Cast price ke number sebelum dikirim
    const menus = rows.map((row) => ({
      ...row,
      price: parseFloat(row.price),
    }));

    res.json(menus);
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

export const getMenusWithCategories = async (req, res) => {
  try {
    const { search } = req.query;

    const params = [];
    let menuFilter = `m.is_active = true`;

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      menuFilter += ` AND LOWER(m.name) LIKE $${params.length}`;
    }

    const { rows } = await pool.query(
      `
      SELECT
        c.id          AS category_id,
        c.name        AS category_name,
        c.description AS category_description,
        c.icon        AS category_icon,
        COUNT(m.id)   AS menu_length,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'menu_id',          m.id,
              'menu_name',        m.name,
              'menu_price',       m.price::float,
              'menu_description', m.description,
              'menu_image',       m.image_url,
              'menu_stock',       m.stock
            ) ORDER BY m.id
          ) FILTER (WHERE m.id IS NOT NULL AND ${menuFilter}),
          '[]'
        ) AS menu_list
      FROM categories c
      LEFT JOIN menus m ON m.category_id = c.id
      GROUP BY c.id, c.name, c.description, c.icon
      ORDER BY c.id
      `,
      params,
    );

    // Kalau ada search, filter category yang menu_list nya kosong
    const filtered = search
      ? rows.filter((cat) => cat.menu_list.length > 0)
      : rows;

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createMenu = async (req, res) => {
  try {
    const { category_id, name, description, price, stock, is_active } =
      req.body;
    const image_url = req.file?.path || req.body.image || null;

    const { rows } = await pool.query(
      `
      WITH inserted AS (
        INSERT INTO menus (category_id, name, description, price, stock, image_url, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      )
      SELECT i.*, c.name AS category_name
      FROM inserted i
      LEFT JOIN categories c ON c.id = i.category_id
      `,
      [
        category_id ? parseInt(category_id) : null,
        name,
        description || null,
        parseFloat(price),
        parseInt(stock ?? "0") ?? 0,
        image_url || null,
        is_active === "false" ? false : true,
      ],
    );

    const menus = {
      ...rows[0],
      price: parseFloat(rows[0].price),
    };

    res.status(201).json(menus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, name, description, price, stock, is_active } =
      req.body;

    if (is_active && !name && !description && !price && !stock) {
      const { rows } = await pool.query(
        `
        WITH updated AS (
          UPDATE menus 
          SET is_active = $1 
          WHERE id = $2 
          RETURNING *
        )
        SELECT u.*, c.name AS category_name
        FROM updated u
        LEFT JOIN categories c ON c.id = u.category_id
        `,
        [is_active, id],
      );

      if (!rows.length)
        return res.status(404).json({ message: "Menu not found" });

      const menu = {
        ...rows[0],
        price: parseFloat(rows[0].price),
      };

      res.json(menu);

      return res.json(menu);
    }

    let image_url = null;

    // Kalau ada gambar baru, hapus gambar lama dari Cloudinary dulu
    if (req.file) {
      // Ada gambar baru → hapus lama dari Cloudinary dulu
      const existing = await pool.query(
        "SELECT image_url FROM menus WHERE id = $1",
        [id],
      );
      const oldUrl = existing.rows[0]?.image_url;

      if (oldUrl) {
        // Ekstrak public_id: "pos-menus/namafile" dari URL Cloudinary
        const parts = oldUrl.split("/");
        const publicId = parts
          .slice(-2)
          .join("/")
          .replace(/\.[^/.]+$/, "");
        await cloudinary.uploader.destroy(publicId);
      }

      image_url = req.file.path; // URL Cloudinary yang baru
    }

    const { rows } = await pool.query(
      `
      WITH inserted AS (
        UPDATE menus
        SET
          category_id = COALESCE($1, category_id),
          name        = COALESCE($2, name),
          description = COALESCE($3, description),
          price       = COALESCE($4::numeric, price),
          stock       = COALESCE($5::int, stock),
          image_url   = COALESCE($6, image_url),  -- kalau null, pakai yang lama
          is_active   = COALESCE($7::boolean, is_active)
        WHERE id = $8
        RETURNING *
      )
      SELECT i.*, c.name AS category_name
      FROM inserted i
      LEFT JOIN categories c ON c.id = i.category_id
      `,
      [
        category_id ? parseInt(category_id) : null,
        name || null,
        description || null,
        price ? parseFloat(price) : null,
        stock ? parseInt(stock) : null,
        image_url, // null kalau tidak ada file baru → COALESCE pakai lama
        is_active != null ? (is_active === "false" ? false : true) : null,
        id,
      ],
    );

    if (!rows.length)
      return res.status(404).json({ message: "Menu not found" });

    const menus = {
      ...rows[0],
      price: parseFloat(rows[0].price),
    };

    res.json(menus);
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
