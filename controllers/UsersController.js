import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const sha1 = require('sha1');
const { ObjectId } = require('mongodb');

class UsersController {
  static postNew(req, res) {
    const { email, password } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Missing email' });
      return;
    }
    if (!password) {
      res.status(400).json({ error: 'Missing password' });
      return;
    }
    const users = dbClient.db.collection('users');
    users.findOne({ email }, async (err, user) => {
      if (user) {
        res.status(400).json({ error: 'Already exist' });
      } else {
        const hashedPass = sha1(password);
        const result = await users.insertOne({ email, password: hashedPass });
        res.status(201).json({ id: result.insertedId, email });
      }
    });
  }

  static async getMe(req, res) {
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
    dbClient.db.collection('users').findOne({ _id: ObjectId(userId) }, (err, user) => {
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
      } else {
        res.status(200).json({ id: user._id, email: user.email });
      }
    });
  }
}
module.exports = UsersController;
