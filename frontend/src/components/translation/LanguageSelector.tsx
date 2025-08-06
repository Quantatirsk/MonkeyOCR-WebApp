/**
 * Language Selector Component
 * Reusable dropdown for selecting source and target languages
 */
import React, { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Search } from 'lucide-react';
import { LanguageSelectorProps, Language, SUPPORTED_LANGUAGES } from '../../types/translation';

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  value,
  onChange,
  languages = SUPPORTED_LANGUAGES,
  placeholder = "Select language",
  disabled = false,
  showFlags = true
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Filter languages based on search query
  const filteredLanguages = languages.filter(lang =>
    lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedLanguage = languages.find(lang => lang.code === value);

  const handleValueChange = (newValue: string) => {
    onChange(newValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <Select
      value={value}
      onValueChange={handleValueChange}
      disabled={disabled}
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <SelectTrigger className="w-full min-w-[140px]">
        <SelectValue placeholder={placeholder}>
          {selectedLanguage && (
            <div className="flex items-center gap-2">
              {showFlags && selectedLanguage.flag && (
                <span className="text-sm">{selectedLanguage.flag}</span>
              )}
              <span className="truncate">
                {selectedLanguage.nativeName}
              </span>
              {selectedLanguage.code === 'auto' && (
                <Badge variant="outline" className="text-xs ml-1">
                  Auto
                </Badge>
              )}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>

      <SelectContent className="w-[280px]">
        {/* Search Input */}
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search languages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* Language Options */}
        <div className="max-h-[200px] overflow-y-auto">
          {filteredLanguages.length === 0 ? (
            <div className="p-3 text-sm text-gray-500 text-center">
              No languages found
            </div>
          ) : (
            filteredLanguages.map((language) => (
              <SelectItem
                key={language.code}
                value={language.code}
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <div className="flex items-center gap-3 w-full">
                  {showFlags && language.flag && (
                    <span className="text-base">{language.flag}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {language.nativeName}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {language.name}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 font-mono">
                    {language.code.toUpperCase()}
                  </div>
                </div>
              </SelectItem>
            ))
          )}
        </div>

        {/* Quick Actions */}
        {searchQuery === '' && (
          <div className="border-t p-2">
            <div className="text-xs text-gray-500 mb-2">Quick Select:</div>
            <div className="flex flex-wrap gap-1">
              {['auto', 'en', 'zh', 'ja', 'ko'].map((code) => {
                const lang = languages.find(l => l.code === code);
                if (!lang) return null;
                
                return (
                  <button
                    key={code}
                    onClick={() => handleValueChange(code)}
                    className="px-2 py-1 text-xs rounded border hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1"
                  >
                    {showFlags && lang.flag && (
                      <span>{lang.flag}</span>
                    )}
                    <span>{lang.nativeName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </SelectContent>
    </Select>
  );
};

// Language Pair Selector Component
export const LanguagePairSelector: React.FC<{
  sourceLanguage: string;
  targetLanguage: string;
  onSourceChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}> = ({
  sourceLanguage,
  targetLanguage,
  onSourceChange,
  onTargetChange,
  disabled = false,
  className = ""
}) => {
  const handleSwapLanguages = () => {
    if (sourceLanguage !== 'auto' && targetLanguage !== 'auto') {
      onSourceChange(targetLanguage);
      onTargetChange(sourceLanguage);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Source Language */}
      <div className="flex-1">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 block">
          From
        </label>
        <LanguageSelector
          value={sourceLanguage}
          onChange={onSourceChange}
          placeholder="Source language"
          disabled={disabled}
        />
      </div>

      {/* Swap Button */}
      <button
        onClick={handleSwapLanguages}
        disabled={disabled || sourceLanguage === 'auto' || targetLanguage === 'auto'}
        className="mt-5 p-2 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Swap languages"
      >
        <svg className="w-4 h-4 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      </button>

      {/* Target Language */}
      <div className="flex-1">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 block">
          To
        </label>
        <LanguageSelector
          value={targetLanguage}
          onChange={onTargetChange}
          placeholder="Target language"
          disabled={disabled}
          languages={SUPPORTED_LANGUAGES.filter(lang => lang.code !== 'auto')} // Exclude auto-detect for target
        />
      </div>
    </div>
  );
};