/**
 * Translation Result Component
 * Displays translation results below original blocks with same styling
 */
import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Copy, Edit3, Check, X, RefreshCw } from 'lucide-react';
import { TranslationResultProps } from '../../types/translation';
import { toast } from '../../hooks/use-toast';

export const TranslationResult: React.FC<TranslationResultProps> = ({
  blockId,
  result,
  sourceLanguage,
  targetLanguage,
  showOriginal = false,
  onCopy,
  onEdit
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(result.translated_content);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.translated_content);
      toast({
        title: "Copied",
        description: "Translation copied to clipboard",
        duration: 2000
      });
      onCopy?.(result.translated_content);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: "Copy failed",
        description: "Failed to copy translation to clipboard",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedContent(result.translated_content);
  };

  const handleSaveEdit = () => {
    onEdit?.(blockId, editedContent);
    setIsEditing(false);
    toast({
      title: "Saved",
      description: "Translation updated",
      duration: 2000
    });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent(result.translated_content);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800';
    }
  };

  const getLanguageFlag = (langCode: string) => {
    const flags: { [key: string]: string } = {
      'zh': '🇨🇳',
      'en': '🇺🇸',
      'ja': '🇯🇵',
      'ko': '🇰🇷',
      'fr': '🇫🇷',
      'de': '🇩🇪',
      'es': '🇪🇸',
      'pt': '🇵🇹',
      'ru': '🇷🇺',
      'ar': '🇸🇦'
    };
    return flags[langCode] || '🌐';
  };

  return (
    <Card className={`mt-3 p-4 border-l-4 ${getStatusColor(result.status)} transition-all duration-200`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            Translation
          </span>
          <div className="flex items-center gap-1 text-xs">
            <span>{getLanguageFlag(sourceLanguage)}</span>
            <span className="text-gray-400">→</span>
            <span>{getLanguageFlag(targetLanguage)}</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {result.status}
          </Badge>
        </div>

        {/* Action Buttons */}
        {result.status === 'completed' && !isEditing && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleCopy}
              title="Copy translation"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleEdit}
              title="Edit translation"
            >
              <Edit3 className="h-3 w-3" />
            </Button>
          </div>
        )}

        {isEditing && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
              onClick={handleSaveEdit}
              title="Save changes"
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-gray-600 hover:text-gray-700"
              onClick={handleCancelEdit}
              title="Cancel editing"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Original Text (if showing) */}
      {showOriginal && result.status === 'completed' && (
        <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Original:</div>
          <div className="text-sm text-gray-700 dark:text-gray-300 markdown-content">
            {result.original_content}
          </div>
        </div>
      )}

      {/* Translation Content */}
      <div className="translation-content">
        {result.status === 'completed' && (
          <>
            {isEditing ? (
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full min-h-[100px] p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <div className="text-sm text-gray-800 dark:text-gray-200 markdown-content leading-relaxed">
                {result.translated_content}
              </div>
            )}
          </>
        )}

        {result.status === 'pending' && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Translating...</span>
          </div>
        )}

        {result.status === 'error' && (
          <div className="text-sm text-red-600 dark:text-red-400">
            <div className="font-medium mb-1">Translation failed:</div>
            <div className="text-xs opacity-80">
              {result.error_message || 'Unknown error occurred'}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

// Explanation Result Component (similar styling but for explanations)
export const ExplanationResult: React.FC<{
  blockId: string;
  content: string;
  explanation: string;
  status: 'completed' | 'error' | 'pending';
  error?: string;
  onCopy?: (content: string) => void;
}> = ({
  blockId,
  content,
  explanation,
  status,
  error,
  onCopy
}) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(explanation);
      toast({
        title: "Copied",
        description: "Explanation copied to clipboard",
        duration: 2000
      });
      onCopy?.(explanation);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: "Copy failed",
        description: "Failed to copy explanation to clipboard",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800';
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800';
    }
  };

  return (
    <Card className={`mt-3 p-4 border-l-4 ${getStatusColor(status)} transition-all duration-200`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            Explanation
          </span>
          <Badge variant="outline" className="text-xs">
            {status}
          </Badge>
        </div>

        {/* Copy Button */}
        {status === 'completed' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleCopy}
            title="Copy explanation"
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Explanation Content */}
      <div className="explanation-content">
        {status === 'completed' && (
          <div className="text-sm text-gray-800 dark:text-gray-200 markdown-content leading-relaxed">
            {explanation}
          </div>
        )}

        {status === 'pending' && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Generating explanation...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="text-sm text-red-600 dark:text-red-400">
            <div className="font-medium mb-1">Explanation failed:</div>
            <div className="text-xs opacity-80">
              {error || 'Unknown error occurred'}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};