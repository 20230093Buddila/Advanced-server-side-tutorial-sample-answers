# Database Setup Instructions

This guide explains how to set up the PostgreSQL database for the Alumni Platform.

## Prerequisites

- PostgreSQL installed on your machine
- Access to `psql` command line tool or a GUI like pgAdmin

## Setup Steps

### 1. Start PostgreSQL

Make sure PostgreSQL is running on your system.

```bash
# macOS (Homebrew)
brew services start postgresql

# Linux
sudo systemctl start postgresql

# Windows
# Start from Services or use pg_ctl
```

### 2. Create the Database

Open the PostgreSQL command line:

```bash
psql -U postgres
```

Then run the SQL file:

```bash
# Option A: From inside psql
\i /path/to/database.sql

# Option B: From terminal directly
psql -U postgres -f database.sql
```

Or manually create the database and tables:

```sql
-- Create the database
CREATE DATABASE week10;

-- Connect to it
\c week10
```

### 3. Create Tables

Run the following SQL commands (or use the `database.sql` file):

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Profiles table
CREATE TABLE profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    biography TEXT,
    linkedin_url VARCHAR(255),
    image_url VARCHAR(255),
    is_complete BOOLEAN DEFAULT FALSE,
    wins_this_month INTEGER DEFAULT 0,
    event_attended BOOLEAN DEFAULT FALSE,
    last_win_date DATE
);

-- Qualifications table
CREATE TABLE qualifications (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
    q_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    organization VARCHAR(255),
    url TEXT,
    completion_date DATE
);

-- Bids table
CREATE TABLE bids (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    bid_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    is_blind_win BOOLEAN DEFAULT FALSE
);
```

### 4. Configure Environment Variables

Create a `.env` file in the project root (copy from `.env.example` if available):

```env
PORT=3000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/week10
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here
UNIVERSITY_DOMAIN=westminster.ac.uk
```

Update the `DATABASE_URL` with your PostgreSQL credentials:

```
postgres://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME
```

| Parameter | Default Value | Description |
|-----------|---------------|-------------|
| USERNAME | postgres | Your PostgreSQL username |
| PASSWORD | postgres | Your PostgreSQL password |
| HOST | localhost | Database server host |
| PORT | 5432 | PostgreSQL port |
| DATABASE_NAME | week10 | Name of the database |

### 5. Verify Connection

Test the database connection:

```bash
psql -U postgres -d week10 -c "\dt"
```

You should see the four tables: `users`, `profiles`, `qualifications`, `bids`.

## Reset Database

To reset the database (delete all data and recreate tables):

```bash
psql -U postgres -d week10 -f database.sql
```

Or run these commands:

```sql
DROP TABLE IF EXISTS bids CASCADE;
DROP TABLE IF EXISTS qualifications CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
```

Then recreate the tables as shown above.

## Troubleshooting

### Connection Refused
- Ensure PostgreSQL is running
- Check if the port 5432 is correct
- Verify your username and password

### Permission Denied
- Make sure the user has privileges on the database
```sql
GRANT ALL PRIVILEGES ON DATABASE week10 TO your_username;
```

### Database Does Not Exist
- Create it manually: `CREATE DATABASE week10;`

## Database Schema Overview

```
users (1) ──────── (1) profiles (1) ──────── (N) qualifications
                        │
                        └──────── (N) bids
```

- **users**: Authentication data (email, password, verification)
- **profiles**: User profile info (bio, LinkedIn, image)
- **qualifications**: Degrees, certifications, courses (3NF)
- **bids**: Marketplace bid records
