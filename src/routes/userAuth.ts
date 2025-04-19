import express from "express";
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import prisma from "../lib/prisma";
import { body, validationResult } from "express-validator"; // Input validation
import { Request, Response, NextFunction } from "express"; // TypeScript types for better typing

const router = express.Router();
const secretKey = process.env.JWT_SECRET_KEY || "your_secret";

// Middleware for validation errors
const validateInput = [
  body("email").isEmail().withMessage("Invalid email format"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("name").not().isEmpty().withMessage("Name is required"),
];

// Error handler middleware
const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
};

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(400).json({ error: "Invalid credentials" });
      return;
    }

    // Check if password matches
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(400).json({ error: "Invalid credentials" });
      return;
    }

    // Define JWT options
    const options: SignOptions = {
      expiresIn: 60 * 60, // Token expiration time in seconds (24 hours)
    };

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      secretKey,
      options
    );

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to log in" });
  }
});

const saltRounds = 10;
router.post("/signup", validateInput, async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  try {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({ error: "Email already in use" });
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create the user in the database
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to sign up" });
    return;
  }
});

router.use(errorHandler);

export default router;
