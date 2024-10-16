import { ObjectID } from 'mongodb';

const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
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
    const userId = await redisClient.get(key);
    const dir = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
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
        res.status(400).json({ error: 'Parent is not a folder' });
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
}
module.exports = FilesController;
