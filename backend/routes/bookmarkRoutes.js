const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  addBookmark,
  getBookmarks,
  deleteBookmark
} = require('../controllers/bookmarkController');

router.use(protect);

router.post('/:schemeId', addBookmark);
router.get('/', getBookmarks);
router.delete('/:schemeId', deleteBookmark);

module.exports = router;
