import { ObjectID } from 'mongodb';
import dbClient from './utils/db';

const Bull = require('bull');
const imageThumbnail = require('image-thumbnail');
const fs = require('fs').promises;

const fileQueue = new Bull('fileQueue', 'redis://127.0.0.1:6379');
const userQueue = new Bull('userQueue', 'redis://127.0.0.1:6379');

fileQueue.process(async (job, done) => {
  const { fileId } = job.data;
  let { userId } = job.data;

  if (!fileId) {
    done(new Error('Missing fileId'));
  }

  if (!userId) {
    done(new Error('Missing userId'));
  }
  const files = dbClient.db.collection('files');
  const _id = new ObjectID(fileId);
  userId = new ObjectID(userId);
  const file = await files.findOne({ _id, userId });
  if (!file) {
    done(new Error('File not found'));
  }
  try {
    const sizes = [100, 250, 500];
    sizes.forEach(async (width) => {
      const thumbnail = await imageThumbnail(file.localPath, { width });
      await fs.writeFile(`${file.localPath}_${width}`, thumbnail);
    });
    done();
  } catch (err) {
    console.error(err);
    done(err);
  }
});

userQueue.process(async (job, done) => {
  const { userId } = job.data;
  if (!userId) {
    done(new Error('Missing userId'));
  }
  const users = dbClient.db.collection('users');
  const _id = new ObjectID(userId);
  const user = await users.findOne({ _id });
  if (!user) {
    done(new Error('User not found'));
  }
  console.log(`Welcome ${user.email}!`);
  done();
});
