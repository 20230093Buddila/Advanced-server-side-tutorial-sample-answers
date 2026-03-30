-- --- 0. CREATE DATABASE ---
CREATE DATABASE week10;
\c week10

-- --- 1. CLEANUP (Optional: Resets the DB) ---
DROP TABLE IF EXISTS bids CASCADE;
DROP TABLE IF EXISTS qualifications CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- --- 2. USERS TABLE (Auth & Security - 15 Marks) ---
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL, -- Validation: must be university domain [cite: 83]
    password_hash TEXT NOT NULL,         -- Bcrypt hashed [cite: 149]
    is_verified BOOLEAN DEFAULT FALSE,   -- For email verification system [cite: 100]
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- 3. PROFILES TABLE (Basic Info - 5 Marks) ---
CREATE TABLE profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    biography TEXT,
    linkedin_url VARCHAR(255),
    image_url VARCHAR(255),               
    is_complete BOOLEAN DEFAULT FALSE,
    wins_this_month INTEGER DEFAULT 0,    -- Monthly limit enforcement (3/month) [cite: 23, 138]
    event_attended BOOLEAN DEFAULT FALSE, -- Bonus: Grants 4th win [cite: 24]
    last_win_date DATE
);

-- --- 4. QUALIFICATIONS TABLE (3NF Separation - 7 Marks) ---
-- Handles multiple degrees, certs, and courses separately 
CREATE TABLE qualifications (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
    q_type VARCHAR(50) NOT NULL, -- 'degree', 'certification', 'licence', 'course' [cite: 52-55]
    title VARCHAR(255) NOT NULL,
    organization VARCHAR(255),
    url TEXT,                    -- URL validation required [cite: 120]
    completion_date DATE
);

-- --- 5. BIDS TABLE (The Marketplace - 8 Marks) ---
CREATE TABLE bids (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,       
    bid_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',  -- 'active', 'won', 'lost'
    is_blind_win BOOLEAN DEFAULT FALSE    
);