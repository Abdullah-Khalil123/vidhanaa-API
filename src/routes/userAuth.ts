import bcrypt from "bcrypt";
import express, { NextFunction, Request, Response } from "express";
import { body, validationResult } from "express-validator"; // Input validation
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import prisma from "../lib/prisma";

const otpMap = new Map<
  string,
  { otp: string; expires: number; password?: string; name?: string }
>();
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

    // Generate and store OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpMap.set(email, { otp, expires: Date.now() + 5 * 60 * 1000 }); // 5 min expiry

    // Send OTP (email here)
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Login OTP",
      text: `Your OTP is: ${otp}`,
    });

    res.json({ message: "OTP sent", step: "verify_otp" });
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

    otpMap.set(email, {
      otp: Math.floor(100000 + Math.random() * 900000).toString(),
      expires: Date.now() + 5 * 60 * 1000,
      password: hashedPassword,
      name,
    });

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Verify your account",
      text: `Your signup OTP is: ${otpMap.get(email)?.otp}`,
    });

    res.status(200).json({ message: "OTP sent", step: "verify_otp" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to initiate signup" });
    return;
  }
});

router.post(
  "/social-login",
  validateInput,
  async (req: Request, res: Response) => {
    const { email, name } = req.body;

    try {
      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name,
            password: "",
          },
        });
      }

      const token = jwt.sign({ id: user.id, email: user.email }, secretKey, {
        expiresIn: 60 * 60,
      });

      res.json({ token, name: user.name, email: user.email });
    } catch (error) {
      console.error("Social login error:", error);
      res.status(500).json({ error: "Failed to process social login" });
    }
  }
);

router.post("/verify-otp", async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  try {
    const record = otpMap.get(email);

    if (!record || record.otp !== otp || Date.now() > record.expires) {
      res.status(400).json({ error: "Invalid or expired OTP" });
    }
    otpMap.delete(email);

    let user = await prisma.user.findUnique({ where: { email } });

    if (record !== undefined && !user) {
      // This means it's a signup flow
      try {
        user = await prisma.user.create({
          data: {
            email,
            password: record.password as string,
            name: record.name as string,
          },
        });
      } catch (error) {
        console.error("User creation error after OTP:", error);
        res.status(500).json({ error: "Failed to create user" });
      }
    }

    const token = jwt.sign({ id: user?.id, email: user?.email }, secretKey, {
      expiresIn: 60 * 60,
    });
    res.json({ token, name: user?.name, email: user?.email });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
});

router.post("/resend-otp", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: "Email is required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      res.status(404).json({ error: "User not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpMap.set(email, { otp, expires: Date.now() + 5 * 60 * 1000 }); // reset OTP

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP (Resent)",
      text: `Your new OTP is: ${otp}`,
    });

    res.json({ message: "OTP resent" });
  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({ error: "Failed to resend OTP" });
  }
});

router.use(errorHandler);

export default router;
