/**
 * DocumentSearch Component
 * Handles document search functionality
 */

import React, { useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../ui/input';

interface DocumentSearchProps {
  placeholder?: string;
  initialValue?: string;
  onSearch: (query: string) => void;
  className?: string;
  inputClassName?: string;
}

export const DocumentSearch: React.FC<DocumentSearchProps> = React.memo(({
  placeholder = "搜索...",
  initialValue = "",
  onSearch,
  className = "",
  inputClassName = "pl-7 h-7 text-xs w-full"
}) => {
  const [localQuery, setLocalQuery] = useState(initialValue);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalQuery(e.target.value);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch(localQuery);
    }
  }, [localQuery, onSearch]);

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={localQuery}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={inputClassName}
      />
    </div>
  );
});