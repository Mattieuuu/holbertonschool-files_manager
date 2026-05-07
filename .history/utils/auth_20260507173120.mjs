import { ObjectId } from 'mongodb';
import dbClient from './db';
import redisClient from './redis';

const getUserFromToken = async (token) => {
  if (!token) {
    return null;
  }

  const userId = await redisClient.get(`auth_${token}`);
  if (!userId) {
    return null;
  }

  const db = dbClient.getDB();
  if (!db) {
    return null;
  }

  try {
    return db.collection('users').findOne({ _id: new ObjectId(userId) });
  } catch (error) {
    return null;
  }
};

export default getUserFromToken;
