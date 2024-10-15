const sha1 = require('sha1');
const dbClient = require('../utils/db');

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
        res.status(201).json({ _id: result.insertedId, email });
      }
    });
  }
}
module.exports = UsersController;
