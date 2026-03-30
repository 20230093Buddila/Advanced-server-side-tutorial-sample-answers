const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const upload = require('../config/multer');

// Middleware to check if user is logged in (for views)
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        req.user = { userId: req.session.userId };
        next();
    } else {
        res.redirect('/login');
    }
};

// Middleware to pass user to all views
const passUserToViews = (req, res, next) => {
    res.locals.user = req.session && req.session.userId ? { id: req.session.userId } : null;
    next();
};

router.use(passUserToViews);

// ==================== AUTH VIEWS ====================

// GET - Register Page
router.get('/register', (req, res) => {
    res.render('register', { title: 'Register' });
});

// POST - Register
router.post('/register', async (req, res) => {
    const { email, password, confirmPassword } = req.body;

    try {
        if (password !== confirmPassword) {
            return res.render('register', { title: 'Register', error: 'Passwords do not match.' });
        }

        const allowedDomain = process.env.UNIVERSITY_DOMAIN || 'westminster.ac.uk';
        if (!email || !email.endsWith(`@${allowedDomain}`)) {
            return res.render('register', { title: 'Register', error: `Registration is restricted to ${allowedDomain} emails only.` });
        }

        if (!password || password.length < 8) {
            return res.render('register', { title: 'Register', error: 'Password must be at least 8 characters long.' });
        }

        const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.render('register', { title: 'Register', error: 'This email is already registered.' });
        }

        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        const newUser = await db.query(
            'INSERT INTO users (email, password_hash, verification_token) VALUES ($1, $2, $3) RETURNING id, email',
            [email, hashedPassword, verificationToken]
        );

        await db.query('INSERT INTO profiles (user_id) VALUES ($1)', [newUser.rows[0].id]);

        res.render('register', { 
            title: 'Register', 
            success: `Registration successful! Verify your email: /verify/${verificationToken}` 
        });

    } catch (err) {
        console.error('Registration Error:', err);
        res.render('register', { title: 'Register', error: 'Internal server error.' });
    }
});

// GET - Verify Email
router.get('/verify/:token', async (req, res) => {
    const { token } = req.params;

    try {
        const userRes = await db.query('SELECT id FROM users WHERE verification_token = $1', [token]);

        if (userRes.rows.length === 0) {
            return res.render('login', { title: 'Login', error: 'Invalid or expired verification token.' });
        }

        await db.query('UPDATE users SET is_verified = true, verification_token = NULL WHERE verification_token = $1', [token]);

        res.render('login', { title: 'Login', success: 'Email verified successfully! You can now login.' });

    } catch (err) {
        console.error('Verification Error:', err);
        res.render('login', { title: 'Login', error: 'Internal server error.' });
    }
});

// GET - Login Page
router.get('/login', (req, res) => {
    res.render('login', { title: 'Login' });
});

// POST - Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const userRes = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = userRes.rows[0];

        if (!user) {
            return res.render('login', { title: 'Login', error: 'Invalid email or password.' });
        }

        if (!user.is_verified) {
            return res.render('login', { title: 'Login', error: 'Please verify your email before logging in.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.render('login', { title: 'Login', error: 'Invalid email or password.' });
        }

        req.session.userId = user.id;
        req.session.email = user.email;

        res.redirect('/alumni');

    } catch (err) {
        console.error('Login Error:', err);
        res.render('login', { title: 'Login', error: 'Internal server error.' });
    }
});

// GET - Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// GET - Forgot Password Page
router.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { title: 'Forgot Password' });
});

// POST - Forgot Password
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        const userRes = await db.query('SELECT id FROM users WHERE email = $1', [email]);

        if (userRes.rows.length === 0) {
            return res.render('forgot-password', { title: 'Forgot Password', error: 'No account found with this email.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        await db.query('UPDATE users SET reset_token = $1 WHERE email = $2', [resetToken, email]);

        res.render('forgot-password', { 
            title: 'Forgot Password', 
            success: 'Password reset link generated.',
            resetLink: `/reset-password/${resetToken}`
        });

    } catch (err) {
        console.error('Forgot Password Error:', err);
        res.render('forgot-password', { title: 'Forgot Password', error: 'Internal server error.' });
    }
});

// GET - Reset Password Page
router.get('/reset-password/:token', (req, res) => {
    res.render('reset-password', { title: 'Reset Password', token: req.params.token });
});

// POST - Reset Password
router.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { newPassword, confirmPassword } = req.body;

    try {
        if (newPassword !== confirmPassword) {
            return res.render('reset-password', { title: 'Reset Password', token, error: 'Passwords do not match.' });
        }

        if (!newPassword || newPassword.length < 8) {
            return res.render('reset-password', { title: 'Reset Password', token, error: 'Password must be at least 8 characters.' });
        }

        const userRes = await db.query('SELECT id FROM users WHERE reset_token = $1', [token]);

        if (userRes.rows.length === 0) {
            return res.render('reset-password', { title: 'Reset Password', token, error: 'Invalid or expired reset token.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await db.query('UPDATE users SET password_hash = $1, reset_token = NULL WHERE reset_token = $2', [hashedPassword, token]);

        res.render('login', { title: 'Login', success: 'Password reset successful! You can now login.' });

    } catch (err) {
        console.error('Reset Password Error:', err);
        res.render('reset-password', { title: 'Reset Password', token, error: 'Internal server error.' });
    }
});

// ==================== ALUMNI VIEW ====================

// GET - Alumni Page (View-only profile with qualifications)
router.get('/alumni', isAuthenticated, async (req, res) => {
    try {
        const profileRes = await db.query('SELECT * FROM profiles WHERE user_id = $1', [req.session.userId]);
        const profile = profileRes.rows[0] || {};

        const profileId = profile.id;
        let qualifications = [];
        
        if (profileId) {
            const qualsRes = await db.query(
                'SELECT * FROM qualifications WHERE profile_id = $1 ORDER BY completion_date DESC',
                [profileId]
            );
            qualifications = qualsRes.rows;
        }

        res.render('alumni', { 
            title: 'Alumni Profile', 
            profile, 
            qualifications,
            email: req.session.email 
        });

    } catch (err) {
        console.error('Alumni Page Error:', err);
        res.render('alumni', { 
            title: 'Alumni Profile', 
            profile: {}, 
            qualifications: [],
            email: req.session.email,
            error: 'Error loading alumni profile.' 
        });
    }
});

// ==================== PROFILE VIEWS ====================

// GET - Profile Page
router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        const profileRes = await db.query('SELECT * FROM profiles WHERE user_id = $1', [req.session.userId]);
        const profile = profileRes.rows[0] || {};

        res.render('profile', { title: 'My Profile', profile });

    } catch (err) {
        console.error('Profile Error:', err);
        res.render('profile', { title: 'My Profile', profile: {}, error: 'Error loading profile.' });
    }
});

// POST - Update Profile
router.post('/profile/update', isAuthenticated, async (req, res) => {
    const { biography, linkedin_url } = req.body;

    try {
        if (linkedin_url && !linkedin_url.includes('linkedin.com')) {
            const profileRes = await db.query('SELECT * FROM profiles WHERE user_id = $1', [req.session.userId]);
            return res.render('profile', { title: 'My Profile', profile: profileRes.rows[0], error: 'Please provide a valid LinkedIn URL.' });
        }

        await db.query(
            'UPDATE profiles SET biography = $1, linkedin_url = $2, is_complete = true WHERE user_id = $3',
            [biography, linkedin_url, req.session.userId]
        );

        const profileRes = await db.query('SELECT * FROM profiles WHERE user_id = $1', [req.session.userId]);
        res.render('profile', { title: 'My Profile', profile: profileRes.rows[0], success: 'Profile updated successfully!' });

    } catch (err) {
        console.error('Profile Update Error:', err);
        res.render('profile', { title: 'My Profile', profile: {}, error: 'Error updating profile.' });
    }
});

// POST - Upload Profile Image
router.post('/profile/upload-image', isAuthenticated, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            const profileRes = await db.query('SELECT * FROM profiles WHERE user_id = $1', [req.session.userId]);
            return res.render('profile', { title: 'My Profile', profile: profileRes.rows[0], error: 'No image file provided.' });
        }

        const imageUrl = `/uploads/${req.file.filename}`;
        await db.query('UPDATE profiles SET image_url = $1 WHERE user_id = $2', [imageUrl, req.session.userId]);

        const profileRes = await db.query('SELECT * FROM profiles WHERE user_id = $1', [req.session.userId]);
        res.render('profile', { title: 'My Profile', profile: profileRes.rows[0], success: 'Profile image uploaded!' });

    } catch (err) {
        console.error('Upload Error:', err);
        const profileRes = await db.query('SELECT * FROM profiles WHERE user_id = $1', [req.session.userId]);
        res.render('profile', { title: 'My Profile', profile: profileRes.rows[0], error: 'Error uploading image.' });
    }
});

// ==================== QUALIFICATIONS VIEWS ====================

// GET - Qualifications Page
router.get('/qualifications', isAuthenticated, async (req, res) => {
    try {
        const profileRes = await db.query('SELECT id FROM profiles WHERE user_id = $1', [req.session.userId]);
        const profileId = profileRes.rows[0]?.id;

        const qualsRes = await db.query('SELECT * FROM qualifications WHERE profile_id = $1 ORDER BY completion_date DESC', [profileId]);

        res.render('qualifications', { title: 'My Qualifications', qualifications: qualsRes.rows });

    } catch (err) {
        console.error('Qualifications Error:', err);
        res.render('qualifications', { title: 'My Qualifications', qualifications: [], error: 'Error loading qualifications.' });
    }
});

// POST - Add Qualification
router.post('/qualifications', isAuthenticated, async (req, res) => {
    const { q_type, title, organization, url, completion_date } = req.body;

    try {
        const profileRes = await db.query('SELECT id FROM profiles WHERE user_id = $1', [req.session.userId]);
        const profileId = profileRes.rows[0]?.id;

        const validTypes = ['degree', 'certification', 'licence', 'course'];
        if (!validTypes.includes(q_type)) {
            const qualsRes = await db.query('SELECT * FROM qualifications WHERE profile_id = $1', [profileId]);
            return res.render('qualifications', { title: 'My Qualifications', qualifications: qualsRes.rows, error: 'Invalid qualification type.' });
        }

        await db.query(
            'INSERT INTO qualifications (profile_id, q_type, title, organization, url, completion_date) VALUES ($1, $2, $3, $4, $5, $6)',
            [profileId, q_type, title, organization, url || null, completion_date || null]
        );

        const qualsRes = await db.query('SELECT * FROM qualifications WHERE profile_id = $1 ORDER BY completion_date DESC', [profileId]);
        res.render('qualifications', { title: 'My Qualifications', qualifications: qualsRes.rows, success: 'Qualification added!' });

    } catch (err) {
        console.error('Add Qualification Error:', err);
        res.render('qualifications', { title: 'My Qualifications', qualifications: [], error: 'Error adding qualification.' });
    }
});

// GET - Edit Qualification Page
router.get('/qualifications/edit/:id', isAuthenticated, async (req, res) => {
    try {
        const profileRes = await db.query('SELECT id FROM profiles WHERE user_id = $1', [req.session.userId]);
        const profileId = profileRes.rows[0]?.id;

        const qualRes = await db.query('SELECT * FROM qualifications WHERE id = $1 AND profile_id = $2', [req.params.id, profileId]);

        if (qualRes.rows.length === 0) {
            return res.redirect('/qualifications');
        }

        res.render('edit-qualification', { title: 'Edit Qualification', qualification: qualRes.rows[0] });

    } catch (err) {
        console.error('Edit Qualification Error:', err);
        res.redirect('/qualifications');
    }
});

// POST - Update Qualification
router.post('/qualifications/edit/:id', isAuthenticated, async (req, res) => {
    const { q_type, title, organization, url, completion_date } = req.body;

    try {
        const profileRes = await db.query('SELECT id FROM profiles WHERE user_id = $1', [req.session.userId]);
        const profileId = profileRes.rows[0]?.id;

        await db.query(
            'UPDATE qualifications SET q_type = $1, title = $2, organization = $3, url = $4, completion_date = $5 WHERE id = $6 AND profile_id = $7',
            [q_type, title, organization, url || null, completion_date || null, req.params.id, profileId]
        );

        res.redirect('/qualifications');

    } catch (err) {
        console.error('Update Qualification Error:', err);
        res.redirect('/qualifications');
    }
});

// POST - Delete Qualification
router.post('/qualifications/delete/:id', isAuthenticated, async (req, res) => {
    try {
        const profileRes = await db.query('SELECT id FROM profiles WHERE user_id = $1', [req.session.userId]);
        const profileId = profileRes.rows[0]?.id;

        await db.query('DELETE FROM qualifications WHERE id = $1 AND profile_id = $2', [req.params.id, profileId]);

        res.redirect('/qualifications');

    } catch (err) {
        console.error('Delete Qualification Error:', err);
        res.redirect('/qualifications');
    }
});

module.exports = router;
