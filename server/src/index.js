const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const connectDB = require('./config/db');
const env = require('./config/environment');

const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const progressRoutes = require('./routes/progressRoutes');
const householdRoutes = require('./routes/householdRoutes');
const coinRoutes = require('./routes/coinRoutes');
const storeRoutes = require('./routes/storeRoutes');

async function bootstrap() {
  await connectDB();

  const app = express();

  const allowedOrigins = env.clientOrigin.split(',').map((origin) => origin.trim());

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
    })
  );

  app.use(express.json());
  app.use(cookieParser());
  app.use(morgan('dev'));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/household', householdRoutes);
  app.use('/api/coins', coinRoutes);
  app.use('/api/store', storeRoutes);
  app.use('/api', taskRoutes);
  app.use('/api', progressRoutes);

  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));

    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ message: 'Not found' });
      }
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  } else {
    app.use((req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ message: 'Not found' });
      }
      return res.status(503).json({
        message: 'Client build not found. Please run `npm run build` inside client/ before serving.',
      });
    });
  }

  app.use((error, _req, res, _next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ message: 'Internal server error' });
  });

  app.listen(env.port, () => {
    console.log(`Server listening on port ${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap application', error);
  process.exit(1);
});
