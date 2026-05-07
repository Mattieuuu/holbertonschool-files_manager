import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db.mjs';
import fileQueue from '../utils/fileQueue.js';
import getUserFromToken from '../utils/auth.mjs';

const writeFileAsync = promisify(fs.writeFile);

const getFolderPath = () => process.env.FOLDER_PATH || '/tmp/files_manager';

const formatFile = (file) => ({
  id: file._id.toString(),
  userId: file.userId.toString(),
  name: file.name,
  type: file.type,
  isPublic: file.isPublic || false,
  parentId: file.parentId === 0 ? 0 : file.parentId.toString(),
});

const parseObjectId = (value) => {
  try {
    return new ObjectId(value);
  } catch (error) {
    return null;
  }
};

const getFileByIdAndUser = async (db, fileId, userId) => {
  const objectId = parseObjectId(fileId);
  if (!objectId) {
    return null;
  }

  return db.collection('files').findOne({
    _id: objectId,
    userId: new ObjectId(userId),
  });
};

const FilesController = {
  async postUpload(req, res) {
    const token = req.headers['x-token'];
    const user = await getUserFromToken(token);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name,
      type,
      parentId = 0,
      isPublic = false,
      data,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const db = dbClient.getDB();
    if (!db) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const files = db.collection('files');
    let parent = parentId;
    if (parent !== 0 && parent !== '0') {
      const parentObjectId = parseObjectId(parent);
      const parentFile = parentObjectId ? await files.findOne({
        _id: parentObjectId,
      }) : null;

      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }

      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }

      parent = parentObjectId;
    }

    const newFile = {
      userId: new ObjectId(user._id.toString()),
      name,
      type,
      isPublic: Boolean(isPublic),
      parentId: parent,
    };

    const folderPath = getFolderPath();
    fs.mkdirSync(folderPath, { recursive: true });

    if (type !== 'folder') {
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const localPath = path.join(folderPath, fileName);
      await writeFileAsync(localPath, Buffer.from(data, 'base64'));
      newFile.localPath = localPath;
    }

    const result = await files.insertOne(newFile);
    const insertedFile = { ...newFile, _id: result.insertedId };

    if (type === 'image') {
      await fileQueue.add({ userId: user._id.toString(), fileId: result.insertedId.toString() });
    }

    return res.status(201).json(formatFile(insertedFile));
  },

  async getShow(req, res) {
    const token = req.headers['x-token'];
    const user = await getUserFromToken(token);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = dbClient.getDB();
    if (!db) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const file = await getFileByIdAndUser(db, req.params.id, user._id.toString());

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(formatFile(file));
  },

  async getIndex(req, res) {
    const token = req.headers['x-token'];
    const user = await getUserFromToken(token);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = dbClient.getDB();
    if (!db) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const page = Number.parseInt(req.query.page || 0, 10);
    const parentId = req.query.parentId === undefined ? 0 : req.query.parentId;
    const match = {
      userId: new ObjectId(user._id.toString()),
      parentId: parentId === '0' || parentId === 0 ? 0 : (() => {
        const objectId = parseObjectId(parentId);
        return objectId || parentId;
      })(),
    };

    const files = await db.collection('files')
      .aggregate([
        { $match: match },
        { $sort: { _id: 1 } },
        { $skip: page * 20 },
        { $limit: 20 },
      ])
      .toArray();

    return res.status(200).json(files.map(formatFile));
  },

  async putPublish(req, res) {
    const token = req.headers['x-token'];
    const user = await getUserFromToken(token);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = dbClient.getDB();
    if (!db) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const file = await getFileByIdAndUser(db, req.params.id, user._id.toString());
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await db.collection('files').updateOne({ _id: file._id }, { $set: { isPublic: true } });
    file.isPublic = true;

    return res.status(200).json(formatFile(file));
  },

  async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    const user = await getUserFromToken(token);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = dbClient.getDB();
    if (!db) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const file = await getFileByIdAndUser(db, req.params.id, user._id.toString());
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await db.collection('files').updateOne({ _id: file._id }, { $set: { isPublic: false } });
    file.isPublic = false;

    return res.status(200).json(formatFile(file));
  },

  async getFile(req, res) {
    const db = dbClient.getDB();
    const objectId = parseObjectId(req.params.id);
    if (!db || !objectId) {
      return res.status(404).json({ error: 'Not found' });
    }

    const file = await db.collection('files').findOne({ _id: objectId });
    if (!file || file.type === 'folder') {
      return res.status(404).json({ error: 'Not found' });
    }

    const requestedSize = req.query.size;
    const localPath = file.localPath || '';
    const filePath = requestedSize && ['500', '250', '100'].includes(requestedSize)
      ? `${localPath}_${requestedSize}`
      : localPath;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.sendFile(filePath);
  },
};

export default FilesController;
