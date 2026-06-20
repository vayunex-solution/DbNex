const express = require('express');
const router = express.Router();
const compareController = require('../controllers/compare.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/', compareController.compareProject);
router.get('/history', compareController.getHistory);

module.exports = router;
