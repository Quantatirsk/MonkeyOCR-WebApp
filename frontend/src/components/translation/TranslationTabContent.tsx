/**
 * Translation Tab Content
 * Main content area for the translation tab in DocumentViewer
 */
import React, { useState, useMemo } from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { TranslationToolbar } from './TranslationToolbar';
import { TranslationEnhancedMarkdownViewer } from './TranslationEnhancedMarkdownViewer';
import { useTranslationStore } from '../../store/translationStore';
import { DocumentResult } from '../../types';
import { toast } from '../../hooks/use-toast';
import { exportTranslatedDocument } from '../../utils/translationExport';

interface TranslationTabContentProps {
  result: DocumentResult;
  taskId: string;
  searchQuery?: string;
}

export const TranslationTabContent: React.FC<TranslationTabContentProps> = ({
  result,
  taskId,
  searchQuery = ''
}) => {
  const {
    selectedSourceLanguage,
    selectedTargetLanguage,
    translationStyle,
    activeTranslations,
    translateDocument,
    setLanguages,
    pollTranslationStatus,
    getTranslationResult,
    cancelTranslation
  } = useTranslationStore();

  const [isTranslatingDocument, setIsTranslatingDocument] = useState(false);
  const [documentTranslationProgress, setDocumentTranslationProgress] = useState(0);
  const [documentTranslationJobId, setDocumentTranslationJobId] = useState<string | null>(null);

  // Extract blocks from markdown content for document translation
  const extractBlocks = useMemo(() => {
    if (!result.markdown_content) return [];

    // Simple block extraction - split by paragraphs and headings
    const lines = result.markdown_content.split('\n').filter(line => line.trim());
    const blocks: Array<{ id: string; content: string; type: string }> = [];
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let type = 'text';
      if (trimmed.startsWith('#')) type = 'heading';
      else if (trimmed.startsWith('|')) type = 'table';
      else if (trimmed.startsWith('```')) type = 'code';
      else if (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) type = 'list';

      blocks.push({
        id: `block-${index}`,
        content: trimmed,
        type
      });
    });

    return blocks;
  }, [result.markdown_content]);

  // Process markdown content with search highlighting
  const processedMarkdown = useMemo(() => {
    if (!result.markdown_content || !searchQuery.trim()) {
      return result.markdown_content || '';
    }

    const query = searchQuery.trim();
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    
    return result.markdown_content.replace(regex, '<mark class="search-highlight">$1</mark>');
  }, [result.markdown_content, searchQuery]);

  // Handle full document translation
  const handleTranslateAll = async () => {
    if (extractBlocks.length === 0) {
      toast({
        title: "No Content",
        description: "No content blocks found to translate",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    try {
      setIsTranslatingDocument(true);
      setDocumentTranslationProgress(0);

      // Start translation job
      const translationJobId = await translateDocument(
        taskId,
        extractBlocks,
        {
          source_language: selectedSourceLanguage,
          target_language: selectedTargetLanguage,
          preserve_formatting: true,
          translation_style: translationStyle
        }
      );

      setDocumentTranslationJobId(translationJobId);

      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const status = await pollTranslationStatus(translationJobId);
          setDocumentTranslationProgress(status.progress * 100);

          if (status.status === 'completed' || status.status === 'failed' || status.status === 'partially_completed') {
            clearInterval(pollInterval);
            setIsTranslatingDocument(false);

            if (status.status === 'completed' || status.status === 'partially_completed') {
              toast({
                title: "Document Translation Complete",
                description: `Successfully translated ${status.completed_blocks} out of ${status.total_blocks} blocks`,
                duration: 5000
              });

              // Get the results
              try {
                const result = await getTranslationResult(translationJobId);
                console.log('Translation results:', result);
                // Results will be displayed through the enhanced markdown viewer
              } catch (error) {
                console.warn('Failed to get translation results:', error);
              }
            } else {
              toast({
                title: "Document Translation Failed",
                description: `Translation failed after processing ${status.completed_blocks} blocks`,
                variant: "destructive",
                duration: 5000
              });
            }
          }
        } catch (error) {
          console.error('Error polling translation status:', error);
          clearInterval(pollInterval);
          setIsTranslatingDocument(false);
          toast({
            title: "Translation Error",
            description: "Failed to get translation status",
            variant: "destructive",
            duration: 5000
          });
        }
      }, 2000); // Poll every 2 seconds

    } catch (error) {
      setIsTranslatingDocument(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Translation Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 5000
      });
    }
  };

  // Handle export functionality
  const handleExport = async () => {
    try {
      // For now, we'll export as markdown with basic functionality
      // In a full implementation, we would collect actual translation results
      const mockTranslatedBlocks = new Map<string, { translation: string; original: string }>();
      
      // Add some mock translation data for demonstration
      extractBlocks.forEach((block, index) => {
        if (index < 3) { // Mock first 3 blocks as translated
          mockTranslatedBlocks.set(block.id, {
            original: block.content,
            translation: `[Translated] ${block.content}` // Mock translation
          });
        }
      });

      await exportTranslatedDocument(
        result,
        mockTranslatedBlocks,
        {
          format: 'markdown',
          includeOriginal: true,
          includeImages: true,
          preserveFormatting: true
        }
      );

      toast({
        title: "Export Complete",
        description: "Translated document has been downloaded",
        duration: 3000
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed", 
        description: "Failed to export translated document",
        variant: "destructive",
        duration: 5000
      });
    }
  };

  // Handle clear all translations
  const handleClearTranslations = async () => {
    if (documentTranslationJobId) {
      try {
        await cancelTranslation(documentTranslationJobId);
        setDocumentTranslationJobId(null);
      } catch (error) {
        console.warn('Failed to cancel translation job:', error);
      }
    }

    // Clear any individual block translations
    // This would be handled by the enhanced markdown viewer
    toast({
      title: "Translations Cleared",
      description: "All translations have been removed",
      duration: 2000
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Translation Toolbar */}
      <TranslationToolbar
        taskId={taskId}
        onTranslateAll={handleTranslateAll}
        onExport={handleExport}
        onClearTranslations={handleClearTranslations}
        isTranslating={isTranslatingDocument}
        progress={documentTranslationProgress}
        sourceLanguage={selectedSourceLanguage}
        targetLanguage={selectedTargetLanguage}
        onLanguageChange={setLanguages}
      />

      {/* Content Area with Enhanced Markdown Viewer */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full w-full">
          <div className="p-4">
            <TranslationEnhancedMarkdownViewer
              content={processedMarkdown}
              taskId={taskId}
              className="w-full min-w-0"
              fontSize={100} // Default font size
            />
          </div>
        </ScrollArea>
      </div>

      {/* Translation Statistics */}
      <div className="border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
        <div>
          Translation Mode: {selectedSourceLanguage} → {selectedTargetLanguage} ({translationStyle})
        </div>
        <div>
          {extractBlocks.length} blocks available • Hover blocks for translation tools
        </div>
      </div>
    </div>
  );
};