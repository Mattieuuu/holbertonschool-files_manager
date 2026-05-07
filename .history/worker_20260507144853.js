import fs from 'fs';
import path from 'path';
import thumbnail from 'image-thumbnail';
import fileQueue from './utils/fileQueue.js';
import dbClient from './utils/db.mjs';

const sizes = [500, 250, 100];

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

  const file = await db.collection('files').findOne({
    _id: dbClient.getDB().collection('users').constructor ? undefined : undefined,
  });

  const collectionFile = await db.collection('files').findOne({
    _id: db.collection('files').constructor ? undefined : undefined,
  });

  const storedFile = await db.collection('files').findOne({
    _id: new (await import('mongodb')).ObjectId(fileId),
    userId: new (await import('mongodb')).ObjectId(userId),
  });

  if (!storedFile) {
    throw new Error('File not found');
  }

  await Promise.all(sizes.map(async (size) => {
    const buffer = await thumbnail(storedFile.localPath, { width: size });
    await fs.promises.writeFile(`${storedFile.localPath}_${size}`, buffer);
  }));
});
