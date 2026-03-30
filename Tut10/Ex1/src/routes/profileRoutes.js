const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const profileController = require('../controllers/profileController');
const upload = require('../config/multer');

// GET /api/v1/profiles/me
// Only logged-in users can see their own profile!
router.get('/me', protect, (req, res) => {
    res.json({
        message: "Welcome to your private profile!",
        user_id: req.user.userId
    });
});


// POST /api/v1/profiles/update
router.post('/update', protect, profileController.updateProfile);

// POST /api/v1/profiles/upload-image
router.post('/upload-image', protect, upload.single('image'), profileController.uploadProfileImage);

// Qualifications CRUD
router.post('/qualifications', protect, profileController.addQualification);
router.put('/qualifications/:id', protect, profileController.updateQualification);
router.delete('/qualifications/:id', protect, profileController.deleteQualification);

module.exports = router;