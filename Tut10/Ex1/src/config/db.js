const { Pool } = require('pg');
require('dotenv').config();

// Configure the connection using environment variables [cite: 200]
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Add security/performance settings
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test the connection immediately on startup
pool.on('connect', () => {
    console.log('Connected to the PostgreSQL database in 3NF structure.');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle database client', err);
    process.exit(-1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};