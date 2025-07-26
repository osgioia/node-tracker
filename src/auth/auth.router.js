import express from "express";
import { body, validationResult } from "express-validator";
import { Counter } from "prom-client";
import { registerUser, loginUser } from "./auth.service.js";

export const authRouter = express.Router();

// Prometheus metrics
const registerCounter = new Counter({
  name: 'auth_register_requests',
  help: 'Count user registrations'
});

const loginCounter = new Counter({
  name: 'auth_login_requests',
  help: 'Count user logins'
});

// Validations
const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers and underscores'),
  body('email')
    .isEmail()
    .withMessage('Invalid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('inviteKey')
    .optional()
    .isString()
    .withMessage('Invalid invitation key')
];

const loginValidation = [
  body('username')
    .notEmpty()
    .withMessage('Username or email required'),
  body('password')
    .notEmpty()
    .withMessage('Password required')
];

// POST /api/auth/register
authRouter.post("/register", registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, inviteKey } = req.body;
    const user = await registerUser({ username, email, password, inviteKey });
    
    registerCounter.inc();
    res.status(201).json({
      message: "User registered successfully",
      user
    });
  } catch (error) {
    if (error.message === "User or email already exists") {
      return res.status(409).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
});

// POST /api/auth/login
authRouter.post("/login", loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;
    const result = await loginUser(username, password);
    
    loginCounter.inc();
    res.json({
      message: "Login successful",
      ...result
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});