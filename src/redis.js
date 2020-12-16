import redis from 'redis';
import { promisify } from 'util';

const host = process.env.REDIS_HOST;
const port = process.env.REDIS_PORT;
const password = process.env.REDIS_PASSWORD;
const redisUrl = process.env.REDIS_URL;

const redisClient = redis.createClient(redisUrl);

redisClient.on('error', (error) => {
  console.error('Error on redis client');
  console.error(error);
});

redisClient.on('connect', () => {
  console.log('Redis client connected');
});

export default {
  get: promisify(redisClient.get).bind(redisClient),
  set: promisify(redisClient.set).bind(redisClient),
  del: promisify(redisClient.del).bind(redisClient),
  rpush: promisify(redisClient.rpush).bind(redisClient),
  lpush: promisify(redisClient.lpush).bind(redisClient),
};
