import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const AppController = {
  getStatus(req, res) {
    return res.status(200).json({ redis: redisClient.isAlive(), db: dbClient.isAlive() });
  },

  async getStats(req, res) {
    const users = await dbClient.nbUsers();
    const files = await dbClient.nbFiles();
    return res.status(200).json({ users, files });
  },
};

export default AppController;
