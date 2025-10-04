import { AuthService } from '../auth.service';
import { createTestUser } from '../../utils/testHelpers';
import db from '../../utils/db.server';
import jwt from 'jsonwebtoken';

jest.mock('../../utils/db.server');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  let authService;

  beforeAll(() => {
    authService = new AuthService();
  });

  describe('validateUser', () => {
    test('should return user for valid credentials', async () => {
      const testUser = createTestUser();
      db.user.findUnique.mockResolvedValue(testUser);
      
      const user = await authService.validateUser(testUser.email, 'testPassword');
      expect(user).toEqual(testUser);
    });

    test('should return null for invalid password', async () => {
      const testUser = createTestUser();
      db.user.findUnique.mockResolvedValue(testUser);
      
      const user = await authService.validateUser(testUser.email, 'wrongPassword');
      expect(user).toBeNull();
    });
  });

  describe('generateToken', () => {
    test('should generate valid JWT token', () => {
      const testUser = createTestUser();
      jwt.sign.mockReturnValue('testToken');
      
      const token = authService.generateToken(testUser);
      expect(token).toBe('testToken');
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: testUser.id, role: testUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
    });
  });
});