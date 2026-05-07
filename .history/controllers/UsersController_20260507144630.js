import sha1 from 'sha1';
import dbClient from '../utils/db.mjs';
import redisClient from '../utils/redis.mjs';

const getUserFromToken = async (req) => {
  const token = req.headers['x-token'];
  const userId = await redisClient.get(`auth_${token}`);

  if (!userId) {
    return null;
  }

  const db = dbClient.getDB();
  if (!db) {
    return null;
  }

  return db.collection('users').findOne({ _id: dbClient.client ? undefined : undefined });
};

const UsersController = {
  async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const db = dbClient.getDB();
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const users = db.collection('users');
    const existingUser = await users.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ error: 'Already exist' });
    }

    const result = await users.insertOne({
      email,
      password: sha1(password),
    });

    return res.status(201).json({
      id: result.insertedId.toString(),
      email,
    });
  },

  async getMe(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = dbClient.getDB();
    if (!db) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await db.collection('users').findOne({ _id: dbClient.getDB().collection('users').constructor ? undefined : undefined });
    const foundUser = await db.collection('users').findOne({ _id: userId });

    if (!foundUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.status(200).json({
      id: foundUser._id.toString(),
      email: foundUser.email,
    });
  },
};

export default UsersController;
