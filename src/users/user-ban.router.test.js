import request from 'supertest';
import express from 'express';
import { userBanRouter } from './user-ban.router.js';
import * as userBanService from './user-ban.service.js';
import { authMiddleware } from '../middleware/auth.js';

jest.mock('./user-ban.service.js');
jest.mock('../middleware/auth.js', () => ({
  authMiddleware: jest.fn((req, res, next) => {
    req.user = { id: 1, username: 'test-admin', role: 'ADMIN' };
    next();
  })
}));

const app = express();
app.use(express.json());
app.use('/api/user-bans', userBanRouter);

// This file has been moved to /src/users/__tests__/user-ban.router.test.js
// This file should be deleted as tests should be in __tests__ folders

console.warn('⚠️  Test file in wrong location. Use src/users/__tests__/user-ban.router.test.js instead');