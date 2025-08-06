/**
 * Translation Toolbar Component
 * Provides controls for full document translation, language selection, and export
 */
import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  Languages, 
  Download, 
  Trash2, 
  Settings,
  Play,
  Pause,
  RefreshCw
} from 'lucide-react';
import { LanguagePairSelector } from './LanguageSelector';
import { TranslationToolbarProps } from '../../types/translation';
import { toast } from '../../hooks/use-toast';

export const TranslationToolbar: React.FC<TranslationToolbarProps> = ({
  taskId,
  onTranslateAll,
  onExport,
  onClearTranslations,
  isTranslating,
  progress,
  sourceLanguage,
  targetLanguage,
  onLanguageChange
}) => {
  const [translationStyle, setTranslationStyle] = useState<'accurate' | 'natural' | 'formal'>('accurate');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const handleTranslateAll = () => {
    if (!sourceLanguage || !targetLanguage) {
      toast({
        title: "Language Selection Required",
        description: "Please select both source and target languages",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    if (targetLanguage === 'auto') {
      toast({
        title: "Invalid Target Language",
        description: "Target language cannot be auto-detect",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    onTranslateAll();
  };

  const handleExport = () => {
    onExport();
  };

  const handleClearTranslations = () => {
    if (window.confirm('Are you sure you want to clear all translations? This action cannot be undone.')) {
      onClearTranslations();
      toast({
        title: "Translations Cleared",
        description: "All translation results have been removed",
        duration: 2000
      });
    }
  };

  const getStyleDescription = (style: string) => {
    switch (style) {
      case 'accurate':
        return 'Precise, literal translation preserving technical terms';
      case 'natural':
        return 'Natural, fluent translation adapted for native speakers';
      case 'formal':
        return 'Professional, formal language with business terminology';
      default:
        return '';
    }
  };

  return (
    <Card className="p-4 mb-4 border-l-4 border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/10">
      <div className="space-y-4">
        {/* Main Controls Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Languages className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Document Translation
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Translate all text blocks in this document
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Advanced Settings Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-gray-600 dark:text-gray-400"
            >
              <Settings className="h-4 w-4 mr-1" />
              Settings
            </Button>

            {/* Export Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isTranslating}
              className="gap-1"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>

            {/* Clear All Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearTranslations}
              disabled={isTranslating}
              className="gap-1 text-red-600 hover:text-red-700 dark:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
            </Button>
          </div>
        </div>

        {/* Language Selection */}
        <LanguagePairSelector
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
          onSourceChange={(source) => onLanguageChange(source, targetLanguage)}
          onTargetChange={(target) => onLanguageChange(sourceLanguage, target)}
          disabled={isTranslating}
        />

        {/* Advanced Settings Panel */}
        {showAdvanced && (
          <div className="p-4 bg-white dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
              Translation Settings
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Translation Style */}
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 block">
                  Translation Style
                </label>
                <Select value={translationStyle} onValueChange={(value: any) => setTranslationStyle(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accurate">
                      <div>
                        <div className="font-medium">Accurate</div>
                        <div className="text-xs text-gray-500">Precise, literal translation</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="natural">
                      <div>
                        <div className="font-medium">Natural</div>
                        <div className="text-xs text-gray-500">Fluent, native-like</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="formal">
                      <div>
                        <div className="font-medium">Formal</div>
                        <div className="text-xs text-gray-500">Professional, business</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {getStyleDescription(translationStyle)}
                </p>
              </div>

              {/* Additional Options */}
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 block">
                  Options
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input 
                      type="checkbox" 
                      defaultChecked 
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Preserve formatting</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Skip images</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Translate tables</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Translation Progress */}
        {isTranslating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Translating document...
                </span>
                <Badge variant="outline" className="text-xs">
                  {Math.round(progress)}%
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPaused(!isPaused)}
                className="gap-1"
              >
                {isPaused ? (
                  <>
                    <Play className="h-3 w-3" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-3 w-3" />
                    Pause
                  </>
                )}
              </Button>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Processing blocks concurrently for faster translation
            </p>
          </div>
        )}

        {/* Action Button */}
        {!isTranslating && (
          <div className="flex justify-center">
            <Button
              onClick={handleTranslateAll}
              disabled={!sourceLanguage || !targetLanguage || targetLanguage === 'auto'}
              className="px-8 gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Languages className="h-4 w-4" />
              Translate All Blocks
            </Button>
          </div>
        )}

        {/* Status Information */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div>
            Translation powered by AI • Concurrent processing enabled
          </div>
          <div>
            Style: {translationStyle} • {sourceLanguage} → {targetLanguage}
          </div>
        </div>
      </div>
    </Card>
  );
};