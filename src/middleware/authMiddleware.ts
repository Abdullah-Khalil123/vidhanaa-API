import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const secretKey = process.env.JWT_SECRET_KEY || "your-secret-key"; // Set this as an environment variable for security

interface UserPayload {
  id: string;
  email: string;
}
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    res.status(401).json({ error: "Authorization token required" });
    return;
  }

  try {
    const decoded = jwt.verify(token, secretKey);
    req.user = {
      id: (decoded as any).id,
      email: (decoded as any).email,
    };
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
};
