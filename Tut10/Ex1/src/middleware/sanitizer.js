const validator = require('validator');

const sanitizeInput = (req, res, next) => {
    if (req.body) {
        for (let key in req.body) {
            if (typeof req.body[key] === 'string') {
                // URL fields should not be escaped (EJS handles output escaping)
                if (key.toLowerCase().includes('url')) {
                    req.body[key] = validator.trim(req.body[key]);
                } else {
                    // Escape HTML entities for non-URL fields to prevent XSS
                    req.body[key] = validator.escape(req.body[key]).trim();
                }
            }
        }
    }
    next();
};

module.exports = { sanitizeInput };