import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Copy, 
  Eye, 
  EyeOff, 
  Trash2, 
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Languages
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { BlockTranslation } from '../../types';
import { llmWrapper } from '../../lib/llmwrapper';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

interface TranslatedContentProps {
  translation: BlockTranslation;
  onRetranslate?: () => void;
  onRemove?: () => void;
  showOriginal?: boolean;
  className?: string;
}

export const TranslatedContent: React.FC<TranslatedContentProps> = ({
  translation,
  onRetranslate,
  onRemove,
  showOriginal = true,
  className = ''
}) => {
  const { toast } = useToast();
  const [isVisible, setIsVisible] = useState(true);
  const [isRetranslating, setIsRetranslating] = useState(false);

  const supportedLanguages = llmWrapper.getSupportedLanguages();
  const sourceLanguage = supportedLanguages.find(lang => lang.code === translation.source_language);
  const targetLanguage = supportedLanguages.find(lang => lang.code === translation.target_language);

  const handleCopyTranslation = async () => {
    try {
      await navigator.clipboard.writeText(translation.translated_text);
      toast({
        title: "Copied to clipboard",
        description: "Translation copied successfully.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleRetranslate = async () => {
    if (!onRetranslate) return;
    
    setIsRetranslating(true);
    try {
      await onRetranslate();
      toast({
        title: "Retranslation complete",
        description: "Block has been retranslated successfully.",
      });
    } catch (error) {
      toast({
        title: "Retranslation failed",
        description: "Could not retranslate the content.",
        variant: "destructive",
      });
    } finally {
      setIsRetranslating(false);
    }
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove();
      toast({
        title: "Translation removed",
        description: "Translation has been deleted.",
      });
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  if (!isVisible) return null;

  return (
    <Card className={`mt-4 border-l-4 border-l-blue-500 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-blue-50/50">
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="flex items-center space-x-1">
            <CheckCircle className="h-3 w-3" />
            <span>Translated</span>
          </Badge>
          
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
            <span>{sourceLanguage?.flag}</span>
            <span>{sourceLanguage?.native_name || translation.source_language}</span>
            <span>→</span>
            <span>{targetLanguage?.flag}</span>
            <span>{targetLanguage?.native_name || translation.target_language}</span>
          </div>
          
          <Badge variant="outline" className="text-xs">
            {translation.model}
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            title={isVisible ? "Hide translation" : "Show translation"}
          >
            {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyTranslation}
            title="Copy translation"
          >
            <Copy className="h-4 w-4" />
          </Button>
          
          {onRetranslate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRetranslate}
              disabled={isRetranslating}
              title="Retranslate"
            >
              <RefreshCw className={`h-4 w-4 ${isRetranslating ? 'animate-spin' : ''}`} />
            </Button>
          )}
          
          {onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              title="Remove translation"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Original Text */}
        {showOriginal && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">Original</Badge>
              <span className="text-xs text-muted-foreground">
                {sourceLanguage?.native_name || translation.source_language}
              </span>
            </div>
            <div className="p-3 bg-gray-50 rounded-md border text-sm">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                className="prose prose-sm max-w-none"
              >
                {translation.original_text}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Translated Text */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Badge variant="default" className="text-xs bg-blue-600">Translation</Badge>
            <span className="text-xs text-muted-foreground">
              {targetLanguage?.native_name || translation.target_language}
            </span>
          </div>
          <div className="p-3 bg-blue-50/30 rounded-md border border-blue-200">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              className="prose prose-sm max-w-none"
            >
              {translation.translated_text}
            </ReactMarkdown>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center space-x-2">
            <Clock className="h-3 w-3" />
            <span>Translated on {formatTimestamp(translation.timestamp)}</span>
          </div>
          
          {translation.model && (
            <div className="flex items-center space-x-1">
              <span>Model:</span>
              <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                {translation.model}
              </code>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

interface TranslationBlockProps {
  blockId: string;
  originalText: string;
  translation?: BlockTranslation;
  isTranslating?: boolean;
  onTranslate?: () => void;
  onRetranslate?: () => void;
  onRemoveTranslation?: () => void;
  showOriginal?: boolean;
  className?: string;
}

export const TranslationBlock: React.FC<TranslationBlockProps> = ({
  blockId,
  originalText,
  translation,
  isTranslating = false,
  onTranslate,
  onRetranslate,
  onRemoveTranslation,
  showOriginal = true,
  className = ''
}) => {
  const { toast } = useToast();

  const handleTranslate = () => {
    if (!onTranslate) return;
    
    try {
      onTranslate();
      toast({
        title: "Translation started",
        description: "This block is being translated...",
      });
    } catch (error) {
      toast({
        title: "Translation failed",
        description: "Could not start translation.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Translation Controls (when no translation exists) */}
      {!translation && !isTranslating && onTranslate && (
        <div className="flex items-center justify-end">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleTranslate}
            className="text-xs"
          >
            <Languages className="h-3 w-3 mr-1" />
            Translate
          </Button>
        </div>
      )}

      {/* Translation Progress */}
      {isTranslating && (
        <Card className="p-3 border-l-4 border-l-yellow-500 bg-yellow-50/30">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-yellow-600" />
            <span className="text-sm text-yellow-800">Translating...</span>
            <Badge variant="outline" className="text-xs">
              {blockId.slice(-8)}
            </Badge>
          </div>
        </Card>
      )}

      {/* Translation Result */}
      {translation && (
        <TranslatedContent
          translation={translation}
          onRetranslate={onRetranslate}
          onRemove={onRemoveTranslation}
          showOriginal={showOriginal}
        />
      )}
    </div>
  );
};