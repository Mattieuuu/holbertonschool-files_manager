import fs from 'fs';
import { ObjectId } from 'mongodb';
import thumbnail from 'image-thumbnail';
import fileQueue from './utils/fileQueue.js';
import dbClient from './utils/db';

const thumbnailSizes = [500, 250, 100];

fileQueue.process(async (job) => {
  const { fileId, userId } = job.data || {};

  if (!fileId) {
    throw new Error('Missing fileId');
  }

  if (!userId) {
    throw new Error('Missing userId');
  }

  const db = dbClient.getDB();
  if (!db) {
    throw new Error('File not found');
  }

  let file;
  try {
    file = await db.collection('files').findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
    });
  } catch (error) {
    throw new Error('File not found');
  }

  if (!file || !file.localPath) {
    throw new Error('File not found');
  }

  await Promise.all(thumbnailSizes.map(async (size) => {
    const buffer = await thumbnail(file.localPath, { width: size });
    await fs.promises.writeFile(`${file.localPath}_${size}`, buffer);
  }));
});
