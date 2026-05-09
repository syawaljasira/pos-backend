import express from "express";
import cors from "cors";
import categoryRoutes from "./routes/category.routes.js";
import menuRoutes from "./routes/menu.routes.js";
import floorRoutes from "./routes/floor.routes.js";
import tableRoutes from "./routes/table.routes.js";
import orderRoutes from "./routes/order.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import reportRoutes from "./routes/report.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

// Contoh menggunakan middleware di Express.js
app.use((req, res, next) => {
  const start = Date.now();
  // Simpan fungsi 'end' asli dari response
  const originalEnd = res.end;

  res.end = function (...args) {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.originalUrl} - Selesai dalam ${duration}ms`,
    );
    // Panggil kembali fungsi 'end' asli
    originalEnd.apply(res, args);
  };
  next();
});

app.use("/api/categories", categoryRoutes);
app.use("/api/menus", menuRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/floors", floorRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reports", reportRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;
