const sha1 = require('sha1');
const { v4: uuidv4 } = require('uuid');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class AuthController {
  static getConnect(req, res) {
    const auth = req.header('Authorization');
    const base64 = auth.split('Basic ');
    const buff = Buffer.from(base64[1], 'base64');
    const credentials = buff.toString('utf-8').split(':');
    if (credentials.length !== 2) {
      res.status(400).json({ error: 'Unauthorized' });
      return;
    }
    const email = credentials[0];
    const password = sha1(credentials[1]);
    dbClient.db.collection('users').findOne({ email, password }, (err, user) => {
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const token = uuidv4();
      const key = `auth_${token}`;
      redisClient.set(key, user._id.toString(), 60 * 60 * 24);
      res.status(200).json({ token });
    });
  }

  static async getDisconnect(req, res) {
    const token = req.header('X-Token');
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    redisClient.del(key);
    res.status(204).json({});
  }
}
module.exports = AuthController;
