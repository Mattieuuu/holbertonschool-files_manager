import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const AuthController = {
  async getConnect(req, res) {
    const authorization = req.headers.authorization || '';

    if (!authorization.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const base64Auth = authorization.split(' ')[1] || '';
    const decoded = Buffer.from(base64Auth, 'base64').toString('utf-8');
    const separatorIndex = decoded.indexOf(':');

    if (separatorIndex === -1) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const email = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);
    const db = dbClient.getDB();

    if (!db) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await db.collection('users').findOne({ email, password: sha1(password) });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = uuidv4();
    await redisClient.set(`auth_${token}`, user._id.toString(), 60 * 60 * 24);

    return res.status(200).json({ token });
  },

  async getDisconnect(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await redisClient.del(`auth_${token}`);
    return res.status(204).end();
  },
};

export default AuthController;
