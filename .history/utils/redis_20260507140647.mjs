import redis from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.client.on('error', (err) => {
      console.error('Redis client error', err);
    });

    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setAsync = promisify(this.client.set).bind(this.client);
    this.delAsync = promisify(this.client.del).bind(this.client);
  }

  isAlive() {
    return this.client && this.client.connected === true;
  }

  async get(key) {
    try {
      const value = await this.getAsync(key);
      return value;
    } catch (err) {
      return null;
    }
  }

  async set(key, value, duration) {
    try {
      // set with expiration in seconds
      await this.setAsync(key, value, 'EX', duration);
      return true;
    } catch (err) {
      return false;
    }
  }

  async del(key) {
    try {
      await this.delAsync(key);
      return true;
    } catch (err) {
      return false;
    }
  }
}

const redisClient = new RedisClient();

export default redisClient;
