#!/usr/bin/env python3
"""
Database migration script to simplify authentication schema
Removes redundant tables and columns, adds simplified share tokens
"""

import sqlite3
import os
import sys
import shutil
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

def backup_database(db_path: str) -> str:
    """Create a backup of the database before migration"""
    backup_path = f"{db_path}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    shutil.copy2(db_path, backup_path)
    print(f"Database backed up to: {backup_path}")
    return backup_path

def migrate_database(db_path: str):
    """Run the migration to simplify auth schema"""
    
    # Create backup first
    backup_path = backup_database(db_path)
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Enable foreign keys
        cursor.execute("PRAGMA foreign_keys = ON")
        
        print("Starting migration...")
        
        # 1. Create new simplified users table
        print("Creating new users table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login_at TIMESTAMP
            )
        """)
        
        # 2. Migrate data from old users table (if it exists)
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        if cursor.fetchone():
            print("Migrating user data...")
            # Check if old table has salt column
            cursor.execute("PRAGMA table_info(users)")
            columns = [col[1] for col in cursor.fetchall()]
            
            if 'salt' in columns:
                # Old schema with salt - keep existing password_hash for backward compatibility
                cursor.execute("""
                    INSERT INTO users_new (id, email, username, password_hash, is_active, created_at, last_login_at)
                    SELECT id, email, username, password_hash, is_active, created_at, last_login_at
                    FROM users
                """)
            else:
                # Already simplified
                cursor.execute("""
                    INSERT INTO users_new (id, email, username, password_hash, is_active, created_at, last_login_at)
                    SELECT id, email, username, password_hash, is_active, created_at, last_login_at
                    FROM users
                """)
            
            # Drop old table and rename new one
            cursor.execute("DROP TABLE users")
        
        cursor.execute("ALTER TABLE users_new RENAME TO users")
        
        # 3. Drop user_sessions table if it exists
        print("Removing user_sessions table...")
        cursor.execute("DROP TABLE IF EXISTS user_sessions")
        
        # 4. Drop task_shares table if it exists
        print("Removing task_shares table...")
        cursor.execute("DROP TABLE IF EXISTS task_shares")
        
        # 5. Create simplified share_tokens table
        print("Creating share_tokens table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS share_tokens (
                token TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                created_by INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES processing_tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        
        # 6. Create indexes for performance
        print("Creating indexes...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_share_tokens_task ON share_tokens(task_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_share_tokens_expires ON share_tokens(expires_at)")
        
        # 7. Update processing_tasks table if needed
        cursor.execute("PRAGMA table_info(processing_tasks)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'access_level' in columns:
            print("Simplifying processing_tasks table...")
            # Remove complex access_level column
            cursor.execute("""
                CREATE TABLE processing_tasks_new AS 
                SELECT 
                    id, user_id, filename, file_type, file_hash, file_size,
                    status, progress, is_public,
                    extraction_type, split_pages, total_pages,
                    processing_duration, from_cache,
                    result_url, error_message,
                    created_at, updated_at, processing_started_at, completed_at,
                    metadata
                FROM processing_tasks
            """)
            cursor.execute("DROP TABLE processing_tasks")
            cursor.execute("ALTER TABLE processing_tasks_new RENAME TO processing_tasks")
        
        # 8. Clean up any other redundant tables
        print("Cleaning up redundant tables...")
        cursor.execute("DROP TABLE IF EXISTS task_status_history")
        
        conn.commit()
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        print(f"Restoring from backup: {backup_path}")
        shutil.copy2(backup_path, db_path)
        raise
    finally:
        conn.close()

def main():
    """Main migration entry point"""
    # Determine database path
    db_path = os.getenv("DATABASE_PATH", "data/monkeyocr.db")
    
    # Check if database exists
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        print("Creating new database with simplified schema...")
        
        # Create directory if needed
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        # Create new database with simplified schema
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Read and execute the simplified schema
        schema_path = Path(__file__).parent.parent / "database" / "simplified_schema.sql"
        if schema_path.exists():
            with open(schema_path, 'r') as f:
                cursor.executescript(f.read())
        else:
            # Create inline if schema file doesn't exist
            cursor.executescript("""
                -- Simplified Authentication Schema
                PRAGMA foreign_keys = ON;
                
                -- Users table (simplified)
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login_at TIMESTAMP
                );
                
                -- Processing tasks table
                CREATE TABLE processing_tasks (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER,
                    filename TEXT NOT NULL,
                    file_type TEXT CHECK(file_type IN ('pdf', 'image')) NOT NULL,
                    file_hash TEXT,
                    file_size INTEGER,
                    status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed')) NOT NULL DEFAULT 'pending',
                    progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
                    is_public BOOLEAN DEFAULT 0,
                    extraction_type TEXT,
                    split_pages BOOLEAN DEFAULT 0,
                    total_pages INTEGER,
                    processing_duration REAL,
                    from_cache BOOLEAN DEFAULT 0,
                    result_url TEXT,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    processing_started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    metadata TEXT,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                );
                
                -- Share tokens table (simplified sharing)
                CREATE TABLE share_tokens (
                    token TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    created_by INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,
                    FOREIGN KEY (task_id) REFERENCES processing_tasks(id) ON DELETE CASCADE,
                    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
                );
                
                -- Indexes
                CREATE INDEX idx_users_email ON users(email);
                CREATE INDEX idx_users_username ON users(username);
                CREATE INDEX idx_tasks_user_id ON processing_tasks(user_id);
                CREATE INDEX idx_tasks_status ON processing_tasks(status);
                CREATE INDEX idx_tasks_created_at ON processing_tasks(created_at);
                CREATE INDEX idx_share_tokens_task ON share_tokens(task_id);
                CREATE INDEX idx_share_tokens_expires ON share_tokens(expires_at);
            """)
        
        conn.commit()
        conn.close()
        print("New database created with simplified schema!")
    else:
        print(f"Migrating existing database at {db_path}")
        migrate_database(db_path)

if __name__ == "__main__":
    main()