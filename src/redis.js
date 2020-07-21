import redis from 'redis';

const port = process.env.REDIS_PORT;
const password = process.env.REDIS_PASSWORD;

const redisClient = redis.createClient({ port, password });

redisClient.on('error', (error) => {
  console.error('Error on redis client');
  console.error(error);
});

export default redisClient;
