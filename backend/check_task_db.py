#!/usr/bin/env python3
"""
Check task in database
"""
import asyncio
import sys

async def check_task(task_id):
    """Check task details in database"""
    from database import get_db_manager
    
    db = get_db_manager()
    
    query = "SELECT id, user_id, is_public, filename FROM processing_tasks WHERE id = ?"
    result = await db.fetch_one(query, (task_id,))
    
    if result:
        print(f"Task found in database:")
        print(f"  ID: {result['id']}")
        print(f"  User ID: {result['user_id']}")
        print(f"  Is Public: {result['is_public']} (type: {type(result['is_public'])})")
        print(f"  Filename: {result['filename']}")
    else:
        print(f"Task {task_id} not found in database")
    
    # Also check all tasks
    print("\nAll tasks in database:")
    all_query = "SELECT id, user_id, is_public, filename FROM processing_tasks ORDER BY created_at DESC LIMIT 5"
    all_results = await db.fetch_all(all_query, ())
    
    for row in all_results:
        print(f"  - {row['id'][:8]}... | user_id={row['user_id']} | is_public={row['is_public']} | {row['filename']}")

async def main():
    if len(sys.argv) > 1:
        task_id = sys.argv[1]
        await check_task(task_id)
    else:
        # Just show all tasks
        await check_task("dummy")

if __name__ == "__main__":
    asyncio.run(main())