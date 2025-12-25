import { createClient } from 'redis';
import { logger } from '../utils/logger';

const redisUrl = process.env.REDIS_URL || 
  `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;

const client = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries: number) => {
      if (retries > 10) {
        logger.error('Too many Redis connection attempts');
        return new Error('Too many retries');
      }
      return Math.min(retries * 100, 3000);
    }
  }
});

client.on('error', (err: Error) => logger.error('Redis Client Error:', err));
client.on('connect', () => logger.info('Redis connected successfully'));
client.on('ready', () => logger.info('Redis is ready'));
client.on('end', () => logger.info('Redis connection closed'));

export const connectRedis = async () => {
  try {
    await client.connect();
    return client;
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

export default client;