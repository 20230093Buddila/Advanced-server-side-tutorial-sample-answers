const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
    let token;

    // 1. Check if the token is in the "Authorization" Header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // 2. Extract the token (removing the "Bearer " prefix)
            token = req.headers.authorization.split(' ')[1];

            // 3. Verify the "Digital ID Card"
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 4. Attach the user's ID to the request so other functions can use it
            req.user = decoded;

            // 5. Move to the next function (the "Controller")
            next();
        } catch (error) {
            console.error("Token verification failed:", error.message);
            return res.status(401).json({ error: "Not authorized, token failed." });
        }
    }

    if (!token) {
        return res.status(401).json({ error: "Not authorized, no token provided." });
    }
};

module.exports = { protect };