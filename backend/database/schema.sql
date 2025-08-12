-- MonkeyOCR WebApp Database Schema
-- SQLite database with user authentication and task management

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    is_verified BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    preferences TEXT, -- JSON field for user preferences
    metadata TEXT -- JSON field for additional metadata
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    refresh_token TEXT UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Processing tasks table
CREATE TABLE IF NOT EXISTS processing_tasks (
    id TEXT PRIMARY KEY, -- UUID from existing system
    user_id INTEGER, -- Nullable for backward compatibility with anonymous tasks
    filename TEXT NOT NULL,
    file_type TEXT CHECK(file_type IN ('pdf', 'image')) NOT NULL,
    file_hash TEXT,
    file_size INTEGER,
    status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed')) NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
    access_level TEXT DEFAULT 'private' CHECK(access_level IN ('private', 'shared', 'public')),
    is_public BOOLEAN DEFAULT 0,
    
    -- Processing metadata
    total_pages INTEGER,
    processing_duration REAL,
    from_cache BOOLEAN DEFAULT 0,
    
    -- Results
    result_url TEXT,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processing_started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Metadata as JSON
    metadata TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Task status history table
CREATE TABLE IF NOT EXISTS task_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES processing_tasks(id) ON DELETE CASCADE
);

-- Task sharing table
CREATE TABLE IF NOT EXISTS task_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    shared_by_user_id INTEGER NOT NULL,
    shared_with_user_id INTEGER,
    shared_with_email TEXT,
    permission_level TEXT CHECK(permission_level IN ('read', 'write', 'delete', 'share', 'admin')) DEFAULT 'read',
    share_token TEXT UNIQUE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accessed_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES processing_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON processing_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON processing_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON processing_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_file_hash ON processing_tasks(file_hash);
CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_status_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_shares_token ON task_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_task_shares_task_id ON task_shares(task_id);
CREATE INDEX IF NOT EXISTS idx_task_shares_shared_with ON task_shares(shared_with_user_id);

-- Create triggers for updated_at timestamp
-- Use WHEN clause to prevent recursion
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
WHEN OLD.updated_at = NEW.updated_at
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_tasks_timestamp 
AFTER UPDATE ON processing_tasks
WHEN OLD.updated_at = NEW.updated_at
BEGIN
    UPDATE processing_tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;