
import { createClient } from 'redis';

const client = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
});

export const connectRedis = async () => {
  await client.connect();
  return client;
};

export default client;
