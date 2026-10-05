require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function listUsers() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find().select('email name provider').lean();
  console.log('Users in database:');
  users.forEach(u => console.log('  ', u.email, '-', u.name, '-', u.provider));
  await mongoose.disconnect();
}

listUsers();