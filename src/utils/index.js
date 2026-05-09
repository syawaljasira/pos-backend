export const generateOrderNumber = async (client) => {
  // Hitung order hari ini
  const { rows } = await client.query(
    `SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURRENT_DATE`,
  );

  const seq = (parseInt(rows[0].count) + 1).toString().padStart(3, "0");
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);

  return `ORD-${seq}-${dd}${mm}${yy}`;
};
