import { db } from '../utils/db.server.js';
import redisClient from '../config/redis-client.js';
import { createUser, getUserById, updateUser } from './users.service.js';

describe('Users Service (Integration)', () => {
  beforeEach(async () => {
    await db.user.deleteMany();
    await redisClient.flushDb();
  });

  afterAll(async () => {
    await db.$disconnect();
    await redisClient.quit();
  });

  it('should create a user and then retrieve it from the database', async () => {
    const userData = {
      username: 'integ-test',
      email: 'integ@test.com',
      password: 'password123'
    };

    const created = await createUser(userData);
    expect(created).toHaveProperty('id');
    expect(created.username).toBe(userData.username);

    const retrieved = await getUserById(created.id);
    expect(retrieved.id).toBe(created.id);
    expect(retrieved.email).toBe(userData.email);
  });

  it('should retrieve a user from cache on the second call', async () => {
    const created = await createUser({
      username: 'cache-test',
      email: 'cache@test.com',
      password: 'password123'
    });

    const userFromDb = await getUserById(created.id);
    expect(userFromDb.id).toBe(created.id);

    const dbSpy = jest.spyOn(db.user, 'findUnique');

    const userFromCache = await getUserById(created.id);
    expect(userFromCache.id).toBe(created.id);

    expect(dbSpy).not.toHaveBeenCalled();

    dbSpy.mockRestore();
  });

  it('should invalidate cache when a user is updated', async () => {
    const created = await createUser({
      username: 'invalidate-test',
      email: 'invalidate@test.com',
      password: 'password123'
    });
    await getUserById(created.id);

    const cachedUser = await redisClient.get(`user:${created.id}`);
    expect(cachedUser).not.toBeNull();

    await updateUser(created.id, { email: 'new-email@test.com' });

    const invalidatedCache = await redisClient.get(`user:${created.id}`);
    expect(invalidatedCache).toBeNull();
  });
});