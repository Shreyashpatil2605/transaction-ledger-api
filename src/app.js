import express from 'express';
import cors from 'cors';
import accountRoutes from './routes/accountRoutes.js';
import transferRoutes from './routes/transferRoutes.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Security and utility middleware
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/accounts', accountRoutes);
app.use('/api/transfers', transferRoutes);

// Catch-all 404 handler
app.use(notFound);

// Centralized error handling
app.use(errorHandler);

export default app;
