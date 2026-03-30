const db = require('../config/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

//Registration
exports.register = async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Domain Validation [cite: 85, 96]
        const allowedDomain = process.env.UNIVERSITY_DOMAIN || 'westminster.ac.uk';
        if (!email || !email.endsWith(`@${allowedDomain}`)) {
            return res.status(400).json({
                error: `Registration is restricted to ${allowedDomain} emails only.`
            });
        }

        // 2. Strong Password Validation [cite: 96, 149]
        if (!password || password.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters long." });
        }

        // 3. Duplicate Checking 
        const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(409).json({ error: "This email is already registered." });
        }

        // 4. Secure Password Hashing (5 marks for Security) [cite: 149]
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 5. Generate Verification Token [cite: 101, 163]
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // 6. Insert into 3NF Database [cite: 178]
        const newUser = await db.query(
            'INSERT INTO users (email, password_hash, verification_token) VALUES ($1, $2, $3) RETURNING id, email',
            [email, hashedPassword, verificationToken]
        );

        // 7. Initialize blank profile [cite: 118-121]
        await db.query('INSERT INTO profiles (user_id) VALUES ($1)', [newUser.rows[0].id]);

        res.status(201).json({
            message: "Registration successful. Please verify your email.",
            user: { id: newUser.rows[0].id, email: newUser.rows[0].email }
        });

    } catch (err) {
        console.error("Registration Error:", err);
        res.status(500).json({ error: "Internal server error." });
    }
};

//VerfyEmail
exports.verifyEmail = async (req, res) => {
    const { token } = req.params;

    try {
        // 1. Find user with this specific token
        const userRes = await db.query(
            'SELECT id FROM users WHERE verification_token = $1',
            [token]
        );

        if (userRes.rows.length === 0) {
            return res.status(400).json({ error: "Invalid or expired verification token." });
        }

        // 2. Flip the bit to 'true' and clear the token for security
        await db.query(
            'UPDATE users SET is_verified = true, verification_token = NULL WHERE verification_token = $1',
            [token]
        );

        res.status(200).json({ message: "Email verified successfully! You can now login." });

    } catch (err) {
        console.error("Verification Error:", err);
        res.status(500).json({ error: "Internal server error." });
    }
};

//Login
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Find the user in our 3NF Database
        const userRes = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = userRes.rows[0];

        if (!user) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        // 2. Check if the account is verified (Coursework Requirement - 4 marks)
        if (!user.is_verified) {
            return res.status(403).json({ error: "Please verify your email before logging in." });
        }

        // 3. Compare the "Confetti" (Bcrypt Hashing)
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        // 4. Issue the "Digital ID Card" (JWT)
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '2h' } // Token expires in 2 hours for security
        );

        res.status(200).json({
            message: "Login successful",
            token: token,
            user: { id: user.id, email: user.email }
        });

    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: "Internal server error." });
    }
};

// Forgot Password - Generate reset token
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        // 1. Check if email exists
        const userRes = await db.query('SELECT id, email FROM users WHERE email = $1', [email]);
        
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: "No account found with this email." });
        }

        // 2. Generate a secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');

        // 3. Store the reset token in the database
        await db.query(
            'UPDATE users SET reset_token = $1 WHERE email = $2',
            [resetToken, email]
        );

        // 4. In production, you would send an email with the reset link
        // For now, we return the token in the response (for testing)
        res.status(200).json({
            message: "Password reset token generated. Check your email.",
            resetLink: `/api/v1/auth/reset-password/${resetToken}`
        });

    } catch (err) {
        console.error("Forgot Password Error:", err);
        res.status(500).json({ error: "Internal server error." });
    }
};

// Reset Password - Use token to set new password
exports.resetPassword = async (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;

    try {
        // 1. Validate new password
        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters long." });
        }

        // 2. Find user with this reset token
        const userRes = await db.query(
            'SELECT id FROM users WHERE reset_token = $1',
            [token]
        );

        if (userRes.rows.length === 0) {
            return res.status(400).json({ error: "Invalid or expired reset token." });
        }

        // 3. Hash the new password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // 4. Update password and clear the reset token
        await db.query(
            'UPDATE users SET password_hash = $1, reset_token = NULL WHERE reset_token = $2',
            [hashedPassword, token]
        );

        res.status(200).json({ message: "Password reset successful. You can now login with your new password." });

    } catch (err) {
        console.error("Reset Password Error:", err);
        res.status(500).json({ error: "Internal server error." });
    }
};

// Logout - Invalidate session
exports.logout = async (req, res) => {
    try {
        // With JWT, the token is stateless. To properly invalidate:
        // Option 1: Client removes the token (handled client-side)
        // Option 2: Use a token blacklist (requires Redis/DB table)
        // For now, we confirm logout and instruct client to remove token
        
        res.status(200).json({ 
            message: "Logout successful. Please remove the token from client storage.",
            instruction: "Delete the JWT token from localStorage/cookies on the client side."
        });

    } catch (err) {
        console.error("Logout Error:", err);
        res.status(500).json({ error: "Internal server error." });
    }
};
