import { ObjectID } from 'mongodb';

const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const mime = require('mime-types');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-Token');
    const { name, type } = req.body;
    const parentId = req.body.parentId || 0;
    const isPublic = req.body.isPublic || false;
    let { data } = req.body;
    const key = `auth_${token}`;
    let userId = await redisClient.get(key);
    const dir = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    userId = new ObjectID(userId);
    if (!name) {
      res.status(400).json({ error: 'Missing name' });
      return;
    }
    if (data) {
      data = Buffer.from(data, 'base64').toString('utf-8');
    }
    const types = ['folder', 'file', 'image'];
    if (!type || !types.includes(type)) {
      res.status(400).json({ error: 'Missing type' });
      return;
    }
    if (type !== 'folder' && !data) {
      res.status(400).json({ error: 'Missing data' });
      return;
    }
    const files = dbClient.db.collection('files');
    if (parentId) {
      const _id = new ObjectID(parentId);
      const file = await files.findOne({ _id, userId });
      if (!file) {
        res.status(400).json({ error: 'Parent not found' });
        return;
      }
      if (file.type !== 'folder') {
        res.status(400).json({ error: 'Parent is not a folder' });
      }
    }
    if (type === 'folder') {
      files.insertOne({
        userId, name, type, isPublic, parentId,
      }).then((addedFile) => {
        res.status(201).json(
          {
            id: addedFile.insertedId,
            userId,
            name,
            type,
            isPublic,
            parentId,
          },
        );
      }).catch((err) => {
        console.log(err);
      });
    } else {
      const localPath = path.join(dir, uuidv4());
      console.log(localPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(localPath, data);
      files.insertOne({
        userId, name, type, isPublic, parentId, localPath,
      }).then((addedFile) => {
        res.status(201).json(
          {
            id: addedFile.insertedId,
            userId,
            name,
            type,
            isPublic,
            parentId,
          },
        );
      }).catch((err) => {
        console.log(err);
      });
    }
  }

  static async getShow(req, res) {
    const token = req.header('X-Token');
    const key = `auth_${token}`;
    let userId = await redisClient.get(key);
    let _id = req.params.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    userId = new ObjectID(userId);
    const files = dbClient.db.collection('files');
    _id = new ObjectID(_id);
    const file = await files.findOne({ _id, userId });
    if (!file) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(200).json(file);
  }

  static async getIndex(req, res) {
    const token = req.header('X-Token');
    const key = `auth_${token}`;
    let userId = await redisClient.get(key);
    let parentId = req.query.parentId || 0;
    const page = parseInt(req.query.page, 10);
    let query;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    userId = new ObjectID(userId);
    if (parentId) {
      parentId = new ObjectID(parentId);
      query = { parentId, userId };
    } else {
      query = { userId };
    }

    const files = dbClient.db.collection('files');
    files.aggregate([
      { $match: query },
      { $skip: page * 20 },
      { $limit: 20 },
      { $set: { id: '$_id' } },
      { $unset: ['_id', 'localPath'] },
    ]).toArray((err, result) => {
      if (result) {
        res.status(200).json(result);
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    });
  }

  static async putPublish(req, res) {
    const token = req.header('X-Token');
    const key = `auth_${token}`;
    let userId = await redisClient.get(key);
    let _id = req.params.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    userId = new ObjectID(userId);
    const files = dbClient.db.collection('files');
    _id = new ObjectID(_id);
    const file = await files.findOneAndUpdate({ _id, userId }, { $set: { isPublic: true } },
      { returnOriginal: false });
    const { value } = file;
    if (!value) {
      res.status(404).json({ error: 'Not found' });
    }
    res.status(200).json(value);
  }

  static async putUnpublish(req, res) {
    const token = req.header('X-Token');
    const key = `auth_${token}`;
    let userId = await redisClient.get(key);
    let _id = req.params.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    userId = new ObjectID(userId);
    const files = dbClient.db.collection('files');
    _id = new ObjectID(_id);
    const file = await files.findOneAndUpdate({ _id, userId }, { $set: { isPublic: false } },
      { returnOriginal: false });
    const { value } = file;
    if (!value) {
      res.status(404).json({ error: 'Not found' });
    }
    res.status(200).json(value);
  }

  static async getFile(req, res) {
    const token = req.header('X-Token');
    const key = `auth_${token}`;
    let userId = await redisClient.get(key);
    let _id = req.params.id;
    if (userId) {
      userId = new ObjectID(userId);
    }
    userId = new ObjectID(userId);
    const files = dbClient.db.collection('files');
    _id = new ObjectID(_id);
    const file = await files.findOne({ _id });
    if (!file) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (!file.isPublic && (`${file.userId}` !== `${userId}`)) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (file.type === 'folder') {
      res.status(400).json({ error: "A folder doesn't have content" });
      return;
    }
    try {
      const data = await fs.readFile(file.localPath, 'utf-8');
      const contentType = mime.contentType(file.name);
      if (contentType) {
        res.set('Content-Type', contentType);
      }
      res.status(200).send(data);
    } catch (err) {
      res.status(404).json({ error: 'Not found' });
    }
  }
}

module.exports = FilesController;
