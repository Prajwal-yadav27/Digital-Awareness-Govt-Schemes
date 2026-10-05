require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User = require('./models/User');
  const orgs = await User.find({ role: 'organizer' }).select('email name role isOrganizerVerified');
  console.log('Organizers:', JSON.stringify(orgs, null, 2));
  await mongoose.disconnect();
}).catch(e => { console.error(e.message); process.exit(1); });
