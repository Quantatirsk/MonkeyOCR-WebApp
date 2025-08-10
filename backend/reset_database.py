#!/usr/bin/env python3
"""
Reset the SQLite database - delete and recreate all tables
"""
import asyncio
import os
import shutil
from pathlib import Path

async def reset_database():
    """Reset the SQLite database"""
    print("=" * 50)
    print("Database Reset Tool")
    print("=" * 50)
    
    # Get database path
    db_path = Path("monkeyocr.db")
    backup_path = Path("monkeyocr.db.backup")
    
    # Backup current database if it exists
    if db_path.exists():
        print(f"\n1. Backing up current database to {backup_path}")
        shutil.copy2(db_path, backup_path)
        print("   ✅ Backup created")
        
        # Delete current database
        print(f"\n2. Deleting current database: {db_path}")
        os.remove(db_path)
        print("   ✅ Database deleted")
    else:
        print("\n1. No existing database found")
    
    # Delete WAL and SHM files if they exist
    wal_path = Path("monkeyocr.db-wal")
    shm_path = Path("monkeyocr.db-shm")
    
    if wal_path.exists():
        print(f"\n3. Deleting WAL file: {wal_path}")
        os.remove(wal_path)
        print("   ✅ WAL file deleted")
    
    if shm_path.exists():
        print(f"\n4. Deleting SHM file: {shm_path}")
        os.remove(shm_path)
        print("   ✅ SHM file deleted")
    
    # Initialize new database
    print("\n5. Initializing new database...")
    from database import init_database
    await init_database()
    print("   ✅ Database initialized with schema")
    
    # Verify tables were created
    print("\n6. Verifying database tables...")
    from database import get_db_manager
    db = get_db_manager()
    
    tables = [
        'users',
        'user_sessions', 
        'processing_tasks',
        'task_status_history',
        'task_shares'
    ]
    
    for table in tables:
        exists = await db.table_exists(table)
        status = "✅" if exists else "❌"
        print(f"   {status} Table '{table}': {'exists' if exists else 'missing'}")
    
    # Get database stats
    stats = await db.get_stats()
    print(f"\n7. Database Statistics:")
    print(f"   - Database size: {stats.get('size_mb', 0):.2f} MB")
    print(f"   - Total tables: {stats.get('table_count', 0)}")
    print(f"   - Total indexes: {stats.get('index_count', 0)}")
    
    # Clean up task result directories
    print("\n8. Cleaning up task result directories...")
    results_dir = Path("results")
    static_dir = Path("static")
    uploads_dir = Path("uploads")
    
    dirs_to_clean = [results_dir, static_dir, uploads_dir]
    
    for dir_path in dirs_to_clean:
        if dir_path.exists() and dir_path.is_dir():
            # Count items before deletion
            item_count = sum(1 for _ in dir_path.iterdir())
            if item_count > 0:
                print(f"   Cleaning {dir_path}: {item_count} items")
                # Remove all subdirectories but keep the main directory
                for item in dir_path.iterdir():
                    if item.is_dir():
                        shutil.rmtree(item)
                    elif item.is_file() and item.name != '.gitkeep':
                        item.unlink()
                print(f"   ✅ Cleaned {dir_path}")
            else:
                print(f"   ℹ️ {dir_path} is already empty")
    
    print("\n" + "=" * 50)
    print("✅ Database reset completed successfully!")
    print("=" * 50)
    print("\nNotes:")
    print("- All tables have been recreated")
    print("- All task data has been cleared")
    print("- All user accounts have been removed")
    print("- Result files have been cleaned up")
    print(f"- Backup saved as: {backup_path}")
    print("\nYou can now:")
    print("1. Register new users")
    print("2. Upload new tasks")
    print("3. Test the authentication system")

async def main():
    """Main entry point"""
    # Confirm with user
    print("\n⚠️ WARNING: This will DELETE all data in the database!")
    print("This includes:")
    print("- All user accounts")
    print("- All processing tasks")
    print("- All task results")
    print("- All session data")
    print("\nA backup will be created before deletion.")
    
    response = input("\nAre you sure you want to continue? (yes/no): ")
    
    if response.lower() in ['yes', 'y']:
        await reset_database()
    else:
        print("\n❌ Database reset cancelled")

if __name__ == "__main__":
    asyncio.run(main())