require('dotenv').config();

const mongoose = require('mongoose');
const User = require('./models/User');

const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

if (!SEED_ADMIN_PASSWORD || typeof SEED_ADMIN_PASSWORD !== 'string' || SEED_ADMIN_PASSWORD.trim() === '') {
  console.error('SEED_ADMIN_PASSWORD is not set. Refusing to seed the admin account with a default password.');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI);

async function seedAdmin() {
  try {
    const exists = await User.findOne({ email: 'admin@gmail.com' });

    if (exists) {
      console.log('Admin already exists');
      process.exit();
    }

    const admin = new User({
      name: 'Admin',
      email: 'admin@gmail.com',
      password: SEED_ADMIN_PASSWORD,
      role: 'admin'
    });

    await admin.save();
    console.log('Admin created successfully');
    process.exit();

  } catch (err) {
    console.error('Admin seed failed:', err.message);
    process.exit(1);
  }
}

seedAdmin();
