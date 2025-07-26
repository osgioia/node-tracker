import jwt from "jsonwebtoken";
import { logMessage } from "../utils/utils.js";

const JWT_SECRET = process.env.JWT_SECRET;

export const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logMessage("warn", "Access without token");
      return res.status(401).json({ error: "Access denied" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    logMessage("error", `Error in auth: ${error.message}`);
    res.status(401).json({ error: "Token invalid or expired" });
  }
};