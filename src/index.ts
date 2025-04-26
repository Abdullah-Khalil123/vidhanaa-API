import express from "express";
import cors from "cors";
import prisma from "./lib/prisma";
import userRoutes from "./routes/users";
import userAuthRoutes from "./routes/userAuth";
import { authMiddleware } from "./middleware/authMiddleware";

// const corsOptions = {
//   origin: process.env.FRONTEND_URL || "http://localhost:3000",
//   credentials: true,
// };

const corsOptions = {
  origin: [process.env.FRONTEND_URL || "http://localhost:3000"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
};

const app = express();

app.use(express.json());

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

const port = process.env.PORT || 3001;

app.use("/api/auth", userAuthRoutes);
app.use("/api/user", authMiddleware, userRoutes);

// Global error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong!" });
  }
);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Handle shutdown gracefully
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

export { prisma };
