import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { SupportedLanguage } from '../../types';
import { llmWrapper } from '../../lib/llmwrapper';
import { Button } from '../ui/button'

interface LanguageSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  excludeLanguages?: string[];
  includeAutoDetect?: boolean;
  disabled?: boolean;
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  value,
  onValueChange,
  placeholder = "Select language",
  excludeLanguages = [],
  includeAutoDetect = false,
  disabled = false,
  className = ''
}) => {
  const supportedLanguages = llmWrapper.getSupportedLanguages();
  
  // Filter languages based on excludes and auto-detect preference
  const availableLanguages = supportedLanguages.filter(lang => {
    const isAutoDetect = lang.code === 'auto';
    if (isAutoDetect && !includeAutoDetect) return false;
    if (!isAutoDetect && excludeLanguages.includes(lang.code)) return false;
    return true;
  });

  const selectedLanguage = supportedLanguages.find(lang => lang.code === value);

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {selectedLanguage && (
            <div className="flex items-center space-x-2">
              <span className="text-lg">{selectedLanguage.flag}</span>
              <span className="font-medium">{selectedLanguage.native_name}</span>
              <span className="text-muted-foreground text-sm">({selectedLanguage.name})</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {availableLanguages.map((language) => (
          <SelectItem key={language.code} value={language.code}>
            <div className="flex items-center space-x-2">
              <span className="text-lg">{language.flag}</span>
              <div className="flex-1">
                <div className="font-medium">{language.native_name}</div>
                <div className="text-sm text-muted-foreground">
                  {language.name} ({language.code})
                </div>
              </div>
              {language.code === 'auto' && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Auto
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

interface QuickLanguageSelectorProps {
  sourceLanguage: string;
  targetLanguage: string;
  onSourceChange: (language: string) => void;
  onTargetChange: (language: string) => void;
  disabled?: boolean;
  className?: string;
}

export const QuickLanguageSelector: React.FC<QuickLanguageSelectorProps> = ({
  sourceLanguage,
  targetLanguage,
  onSourceChange,
  onTargetChange,
  disabled = false,
  className = ''
}) => {
  const supportedLanguages = llmWrapper.getSupportedLanguages();
  const popularLanguages = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de'];
  
  const popularLangObjects = popularLanguages
    .map(code => supportedLanguages.find(lang => lang.code === code))
    .filter((lang): lang is SupportedLanguage => lang !== undefined);

  const handleSwapLanguages = () => {
    if (sourceLanguage !== 'auto' && targetLanguage !== 'auto') {
      onSourceChange(targetLanguage);
      onTargetChange(sourceLanguage);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main Language Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">From</label>
          <LanguageSelector
            value={sourceLanguage}
            onValueChange={onSourceChange}
            placeholder="Select source language"
            excludeLanguages={[targetLanguage]}
            includeAutoDetect={true}
            disabled={disabled}
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">To</label>
          <LanguageSelector
            value={targetLanguage}
            onValueChange={onTargetChange}
            placeholder="Select target language"
            excludeLanguages={sourceLanguage === 'auto' ? [] : [sourceLanguage]}
            includeAutoDetect={false}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Quick Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Quick Select</label>
        <div className="flex flex-wrap gap-2">
          {popularLangObjects.map((lang) => (
            <Button
              key={lang.code}
              variant="outline"
              size="sm"
              className={`text-xs ${
                targetLanguage === lang.code ? 'bg-blue-100 border-blue-300' : ''
              }`}
              onClick={() => onTargetChange(lang.code)}
              disabled={disabled || sourceLanguage === lang.code}
            >
              <span className="mr-1">{lang.flag}</span>
              {lang.native_name}
            </Button>
          ))}
        </div>
      </div>

      {/* Language Swap */}
      {sourceLanguage !== 'auto' && targetLanguage !== 'auto' && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSwapLanguages}
            disabled={disabled}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ⇄ Swap languages
          </Button>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;