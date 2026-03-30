const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const viewRoutes = require('./routes/viewRoutes');
const { sanitizeInput } = require('./middleware/sanitizer');
require('dotenv').config();

const app = express();

// --- EJS View Engine Setup ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- 1. Global Security Middleware ---
app.use(helmet({ contentSecurityPolicy: false })); // Disabled CSP for inline styles
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Parse form data
app.use(sanitizeInput);

// --- Session Configuration ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'alumni-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true in production with HTTPS
        maxAge: 2 * 60 * 60 * 1000 // 2 hours
    }
}));

// --- Static Files (for uploaded images) ---
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- 2. Request Logging/Usage Statistics ---
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// --- 3. Routes ---

// View Routes (EJS pages)
app.use('/', viewRoutes);

// API Routes (JSON responses)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profiles', profileRoutes);

// --- 4. Error Handling Middleware ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    // Handle Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    if (err.message === 'Invalid file type. Only JPEG, PNG and GIF are allowed.') {
        return res.status(400).json({ error: err.message });
    }
    
    res.status(500).json({ error: 'Something went wrong! Proper error handling implemented.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Swagger docs will be available at http://localhost:${PORT}/api-docs`);
});
