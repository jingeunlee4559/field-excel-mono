require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');

const pool = require('./config/db');
const {
  getAiStorageRoot,
  getUploadsDir,
  getTemplatesDir,
  getResultsDir,
  ensureDir,
} = require('./utils/storagePath');

const authRoutes = require('./routes/authRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const referenceRoutes = require('./routes/referenceRoutes');
const aiRoutes = require('./routes/aiRoutes');
const validationRoutes = require('./routes/validationRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const excelRoutes = require('./routes/excelRoutes');
const templateRoutes = require('./routes/templateRoutes');
const templateMappingRoutes = require('./routes/templateMappingRoutes');
const auditRoutes = require('./routes/auditRoutes');
const reportRoutes = require('./routes/reportRoutes');
const correctionRoutes = require('./routes/correctionRoutes');

const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

const app = express();
const PORT = process.env.PORT || 8080;

const AI_STORAGE_ROOT = getAiStorageRoot();
const UPLOADS_DIR = getUploadsDir();
const TEMPLATES_DIR = getTemplatesDir();
const RESULTS_DIR = getResultsDir();

ensureDir(AI_STORAGE_ROOT);
ensureDir(UPLOADS_DIR);
ensureDir(TEMPLATES_DIR);
ensureDir(RESULTS_DIR);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

app.use(morgan('dev'));

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  if (
    req.path.startsWith('/ai-storage') ||
    req.path.startsWith('/uploads') ||
    req.path.startsWith('/templates-storage') ||
    req.path.startsWith('/results-storage')
  ) {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader(
      'Access-Control-Allow-Origin',
      process.env.FRONTEND_URL || 'http://localhost:3000'
    );
  }

  next();
});

const staticOptions = {
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader(
      'Access-Control-Allow-Origin',
      process.env.FRONTEND_URL || 'http://localhost:3000'
    );
  },
};

/**
 * Python AI 서버 저장소를 백엔드가 정적 파일로 제공한다.
 *
 * 실제 저장소:
 *   ai-server/app/storage
 *
 * 프론트 접근 URL:
 *   http://localhost:8080/ai-storage/uploads/파일명.jpg
 */
app.use('/ai-storage', express.static(AI_STORAGE_ROOT, staticOptions));
app.use('/uploads', express.static(UPLOADS_DIR, staticOptions));
app.use('/templates-storage', express.static(TEMPLATES_DIR, staticOptions));
app.use('/results-storage', express.static(RESULTS_DIR, staticOptions));

app.get('/api/health', (req, res) => {
  return res.json({
    status: 'OK',
    message: 'Backend server is running',
    aiStorageRoot: AI_STORAGE_ROOT,
    uploadsDir: UPLOADS_DIR,
    templatesDir: TEMPLATES_DIR,
    resultsDir: RESULTS_DIR,
    exists: {
      aiStorageRoot: fs.existsSync(AI_STORAGE_ROOT),
      uploadsDir: fs.existsSync(UPLOADS_DIR),
      templatesDir: fs.existsSync(TEMPLATES_DIR),
      resultsDir: fs.existsSync(RESULTS_DIR),
    },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/reference', referenceRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/validation', validationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/excel', excelRoutes);
app.use('/api/admin/templates', templateRoutes);
app.use('/api/admin/templates/:templateId/mappings', templateMappingRoutes);
app.use('/api/admin/audit-logs', auditRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin/corrections', correctionRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    console.log('MySQL connected');
    console.log('AI_STORAGE_ROOT:', AI_STORAGE_ROOT);
    console.log('UPLOADS_DIR:', UPLOADS_DIR);
    console.log('TEMPLATES_DIR:', TEMPLATES_DIR);
    console.log('RESULTS_DIR:', RESULTS_DIR);

    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server');
    console.error(error);
    process.exit(1);
  }
};

startServer();
