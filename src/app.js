import express from "express";
import cors from "cors";
import categoryRoutes from "./routes/category.routes.js";
import menuRoutes from "./routes/menu.routes.js";
import tableRoutes from "./routes/table.routes.js";
import orderRoutes from "./routes/order.routes.js";
import reportRoutes from "./routes/report.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/categories", categoryRoutes);
app.use("/api/menus", menuRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reports", reportRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;
