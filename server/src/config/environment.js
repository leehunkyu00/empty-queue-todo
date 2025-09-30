const dotenv = require('dotenv');

dotenv.config();

const environment = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/empty_queue',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-change-me',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173',
};

module.exports = environment;
