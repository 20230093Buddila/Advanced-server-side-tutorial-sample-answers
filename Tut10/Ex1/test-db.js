// test-db.js
const db = require('./src/config/db');

async function testConnection() {
    console.log("Attempting to connect to the database...");
    try {
        // 1. Check the current time from the DB server
        const timeRes = await db.query('SELECT NOW()');
        console.log('Connection Successful!');
        console.log('Current DB Time:', timeRes.rows[0].now);

        // 2. Check if your 3NF tables are present 
        const tableRes = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        const tables = tableRes.rows.map(r => r.table_name);
        console.log('Tables found in alumni_db:', tables.join(', '));

        if (tables.includes('users') && tables.includes('profiles')) {
            console.log('Ready to start Alumni Registration & Authentication logic!');
        } else {
            console.log('Warning: Tables missing. Please re-run your database.sql script.');
        }

        process.exit(0);
    } catch (err) {
        console.error('Database connection failed!');
        console.error('Error details:', err.message);
        process.exit(1);
    }
}

testConnection();
