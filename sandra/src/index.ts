import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { prisma } from "./config/prisma";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/health", async (_request, response) => {
  try {
    await prisma.$connect();
    response.json({
      status: "ok",
      database: "connected",
      message: "Classroom Companion API is running"
    });
  }
  catch (error) {
    response.json({
      status: "error",
      database: "disconnected",
      message: "Classroom Companion API is not running"
    })
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});