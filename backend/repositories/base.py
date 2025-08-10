"""
Base repository class with common database operations
"""

import logging
from typing import Dict, List, Optional, Any, TypeVar, Generic
from database import DatabaseManager

logger = logging.getLogger(__name__)

T = TypeVar('T')


class BaseRepository(Generic[T]):
    """
    Base repository with common CRUD operations
    """
    
    def __init__(self, db_manager: DatabaseManager, table_name: str):
        self.db = db_manager
        self.table_name = table_name
    
    async def create(self, data: Dict[str, Any]) -> int:
        """
        Create a new record
        """
        columns = ', '.join(data.keys())
        placeholders = ', '.join(['?' for _ in data])
        query = f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders})"
        
        return await self.db.insert_returning_id(query, tuple(data.values()))
    
    async def get_by_id(self, id_field: str, id_value: Any) -> Optional[Dict[str, Any]]:
        """
        Get a record by ID
        """
        query = f"SELECT * FROM {self.table_name} WHERE {id_field} = ?"
        return await self.db.fetch_one(query, (id_value,))
    
    async def get_all(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Get all records with pagination
        """
        query = f"SELECT * FROM {self.table_name} LIMIT ? OFFSET ?"
        return await self.db.fetch_all(query, (limit, offset))
    
    async def update(self, id_field: str, id_value: Any, data: Dict[str, Any]) -> bool:
        """
        Update a record
        """
        if not data:
            return False
            
        set_clause = ', '.join([f"{k} = ?" for k in data.keys()])
        query = f"UPDATE {self.table_name} SET {set_clause} WHERE {id_field} = ?"
        values = list(data.values()) + [id_value]
        
        await self.db.execute(query, tuple(values))
        return True
    
    async def delete(self, id_field: str, id_value: Any) -> bool:
        """
        Delete a record
        """
        query = f"DELETE FROM {self.table_name} WHERE {id_field} = ?"
        await self.db.execute(query, (id_value,))
        return True
    
    async def exists(self, field: str, value: Any) -> bool:
        """
        Check if a record exists
        """
        query = f"SELECT 1 FROM {self.table_name} WHERE {field} = ? LIMIT 1"
        result = await self.db.fetch_one(query, (value,))
        return result is not None
    
    async def count(self, where_clause: Optional[str] = None, params: tuple = ()) -> int:
        """
        Count records
        """
        query = f"SELECT COUNT(*) as count FROM {self.table_name}"
        if where_clause:
            query += f" WHERE {where_clause}"
        
        result = await self.db.fetch_one(query, params)
        return result['count'] if result else 0
    
    async def find_by_field(self, field: str, value: Any) -> List[Dict[str, Any]]:
        """
        Find records by a specific field
        """
        query = f"SELECT * FROM {self.table_name} WHERE {field} = ?"
        return await self.db.fetch_all(query, (value,))
    
    async def find_with_conditions(
        self, 
        conditions: Dict[str, Any],
        order_by: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Find records with multiple conditions
        """
        where_clauses = []
        values = []
        
        for field, value in conditions.items():
            if value is None:
                where_clauses.append(f"{field} IS NULL")
            else:
                where_clauses.append(f"{field} = ?")
                values.append(value)
        
        query = f"SELECT * FROM {self.table_name}"
        if where_clauses:
            query += f" WHERE {' AND '.join(where_clauses)}"
        
        if order_by:
            query += f" ORDER BY {order_by}"
        
        query += f" LIMIT ? OFFSET ?"
        values.extend([limit, offset])
        
        return await self.db.fetch_all(query, tuple(values))
    
    async def execute_query(self, query: str, params: tuple = ()) -> List[Dict[str, Any]]:
        """
        Execute a custom query
        """
        return await self.db.fetch_all(query, params)
    
    async def execute_update(self, query: str, params: tuple = ()) -> None:
        """
        Execute a custom update/delete query
        """
        await self.db.execute(query, params)