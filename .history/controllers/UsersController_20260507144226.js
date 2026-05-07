import sha1 from 'sha1';
import dbClient from '../utils/db.mjs';

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
};

export default UsersController;
