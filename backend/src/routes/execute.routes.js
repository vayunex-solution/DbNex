const express = require('express');
const router = express.Router();
const executeController = require('../controllers/execute.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/analyze', executeController.analyzeScript);
router.post('/run', executeController.executeScript);
router.get('/logs', executeController.getExecutionLogs);
router.get('/logs/:id', executeController.getExecutionLogById);

module.exports = router;
