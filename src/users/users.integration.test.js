import { db } from '../utils/db.server.js';
import redisClient from '../config/redis-client.js';
import { createUser, getUserById, updateUser } from './users.service.js';

describe('Users Service (Integration)', () => {
  // Clean up the database before each test
  beforeEach(async () => {
    await db.user.deleteMany();
    // It's also a good practice to flush Redis
    await redisClient.flushDb();
  });

  // Disconnect Prisma and Redis after all tests
  afterAll(async () => {
    await db.$disconnect();
    await redisClient.quit();
  });

  it('should create a user and then retrieve it from the database', async () => {
    const userData = {
      username: 'integ-test',
      email: 'integ@test.com',
      password: 'password123',
    };

    // 1. Create the user
    const created = await createUser(userData);
    expect(created).toHaveProperty('id');
    expect(created.username).toBe(userData.username);

    // 2. Retrieve the user and check if it matches
    const retrieved = await getUserById(created.id);
    expect(retrieved.id).toBe(created.id);
    expect(retrieved.email).toBe(userData.email);
  });

  it('should retrieve a user from cache on the second call', async () => {
    // 1. Create user
    const created = await createUser({
      username: 'cache-test',
      email: 'cache@test.com',
      password: 'password123',
    });

    // 2. First call: should hit the DB and populate cache
    const userFromDb = await getUserById(created.id);
    expect(userFromDb.id).toBe(created.id);

    // Spy on the database to confirm it's NOT called again
    const dbSpy = jest.spyOn(db.user, 'findUnique');

    // 3. Second call: should hit the cache
    const userFromCache = await getUserById(created.id);
    expect(userFromCache.id).toBe(created.id);

    // Assert that the database was not queried on the second call
    expect(dbSpy).not.toHaveBeenCalled();

    dbSpy.mockRestore();
  });

  it('should invalidate cache when a user is updated', async () => {
    // 1. Create user and get it to populate cache
    const created = await createUser({
      username: 'invalidate-test',
      email: 'invalidate@test.com',
      password: 'password123',
    });
    await getUserById(created.id);

    // 2. Check if it's in cache
    const cachedUser = await redisClient.get(`user:${created.id}`);
    expect(cachedUser).not.toBeNull();

    // 3. Update the user
    await updateUser(created.id, { email: 'new-email@test.com' });

    // 4. Check if the cache was deleted (invalidated)
    const invalidatedCache = await redisClient.get(`user:${created.id}`);
    expect(invalidatedCache).toBeNull();
  });
});