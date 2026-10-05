require('dotenv').config();
const nodemailer = require('nodemailer');

const pass = process.env.SMTP_PASS || '';
const user = process.env.SMTP_USER || '';

console.log('SMTP username:', user);
console.log('Password length:', pass.length);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

transporter.verify()
  .then(() => {
    console.log('Success: true');
    console.log('Error code: none');
    console.log('Response code: 250');
    console.log('Gmail response: OK');
  })
  .catch((err) => {
    console.log('Success: false');
    console.log('Error code:', err.code);
    console.log('Response code:', err.responseCode);
    console.log('Gmail response:', err.response);
  });