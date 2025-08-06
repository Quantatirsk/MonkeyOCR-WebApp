/**
 * Translation Export Utilities
 * Handles exporting translated documents in various formats
 */
import { DocumentResult } from '../types';
import { TranslationExportOptions, TranslationExportResult } from '../types/translation';

export class TranslationExporter {
  /**
   * Export translated document in specified format
   */
  static async exportTranslation(
    originalDocument: DocumentResult,
    translatedBlocks: Map<string, { translation: string; original: string }>,
    options: TranslationExportOptions
  ): Promise<TranslationExportResult> {
    switch (options.format) {
      case 'markdown':
        return this.exportAsMarkdown(originalDocument, translatedBlocks, options);
      case 'html':
        return this.exportAsHTML(originalDocument, translatedBlocks, options);
      case 'bilingual':
        return this.exportAsBilingual(originalDocument, translatedBlocks, options);
      case 'json':
        return this.exportAsJSON(originalDocument, translatedBlocks, options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Export as markdown with translations
   */
  private static exportAsMarkdown(
    originalDocument: DocumentResult,
    translatedBlocks: Map<string, { translation: string; original: string }>,
    options: TranslationExportOptions
  ): TranslationExportResult {
    let content = '';
    
    if (options.includeOriginal) {
      content += '# Original Document\n\n';
      content += originalDocument.markdown_content + '\n\n';
      content += '---\n\n';
    }
    
    content += '# Translated Document\n\n';
    
    // Process the original markdown and replace with translations where available
    const lines = originalDocument.markdown_content.split('\n');
    let blockIndex = 0;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        content += '\n';
        continue;
      }
      
      const blockId = `block-${blockIndex}`;
      const translatedBlock = translatedBlocks.get(blockId);
      
      if (translatedBlock) {
        content += translatedBlock.translation + '\n';
      } else {
        content += line + '\n';
      }
      
      blockIndex++;
    }
    
    // Add metadata
    content += '\n\n---\n\n';
    content += '*Translated with MonkeyOCR AI Translation*\n';
    content += `*Export Date: ${new Date().toISOString()}*\n`;
    content += `*Blocks Translated: ${translatedBlocks.size}*\n`;
    
    return {
      content,
      filename: `${originalDocument.task_id}_translated.md`,
      mimeType: 'text/markdown',
      size: new Blob([content]).size
    };
  }

  /**
   * Export as HTML with styling
   */
  private static exportAsHTML(
    originalDocument: DocumentResult,
    translatedBlocks: Map<string, { translation: string; original: string }>,
    options: TranslationExportOptions
  ): TranslationExportResult {
    let content = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Translated Document - ${originalDocument.task_id}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
        }
        .original-block {
            background-color: #f8f9fa;
            border-left: 4px solid #6c757d;
            padding: 10px;
            margin: 10px 0;
        }
        .translated-block {
            background-color: #e8f4fd;
            border-left: 4px solid #0066cc;
            padding: 10px;
            margin: 10px 0;
        }
        .block-pair {
            margin: 20px 0;
        }
        .metadata {
            border-top: 1px solid #dee2e6;
            margin-top: 40px;
            padding-top: 20px;
            font-size: 0.9em;
            color: #6c757d;
        }
        h1, h2, h3, h4, h5, h6 {
            color: #212529;
        }
        img {
            max-width: 100%;
            height: auto;
        }
    </style>
</head>
<body>
    <h1>Translated Document</h1>
`;

    if (options.includeOriginal) {
      content += '<div class="bilingual-content">\n';
      
      const lines = originalDocument.markdown_content.split('\n');
      let blockIndex = 0;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        const blockId = `block-${blockIndex}`;
        const translatedBlock = translatedBlocks.get(blockId);
        
        if (translatedBlock) {
          content += '<div class="block-pair">\n';
          content += `<div class="original-block">${this.escapeHtml(translatedBlock.original)}</div>\n`;
          content += `<div class="translated-block">${this.escapeHtml(translatedBlock.translation)}</div>\n`;
          content += '</div>\n';
        } else {
          content += `<p>${this.escapeHtml(line)}</p>\n`;
        }
        
        blockIndex++;
      }
      
      content += '</div>\n';
    } else {
      // Translation only
      const lines = originalDocument.markdown_content.split('\n');
      let blockIndex = 0;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        const blockId = `block-${blockIndex}`;
        const translatedBlock = translatedBlocks.get(blockId);
        
        if (translatedBlock) {
          content += `<p>${this.escapeHtml(translatedBlock.translation)}</p>\n`;
        } else {
          content += `<p>${this.escapeHtml(line)}</p>\n`;
        }
        
        blockIndex++;
      }
    }

    content += `
    <div class="metadata">
        <p><strong>Translation Information:</strong></p>
        <ul>
            <li>Original Task ID: ${originalDocument.task_id}</li>
            <li>Export Date: ${new Date().toLocaleString()}</li>
            <li>Blocks Translated: ${translatedBlocks.size}</li>
            <li>Translation Tool: MonkeyOCR AI Translation</li>
        </ul>
    </div>
</body>
</html>
`;

    return {
      content,
      filename: `${originalDocument.task_id}_translated.html`,
      mimeType: 'text/html',
      size: new Blob([content]).size
    };
  }

  /**
   * Export as bilingual document (side-by-side)
   */
  private static exportAsBilingual(
    originalDocument: DocumentResult,
    translatedBlocks: Map<string, { translation: string; original: string }>,
    options: TranslationExportOptions
  ): TranslationExportResult {
    let content = '# Bilingual Document\n\n';
    
    const lines = originalDocument.markdown_content.split('\n');
    let blockIndex = 0;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        content += '\n';
        continue;
      }
      
      const blockId = `block-${blockIndex}`;
      const translatedBlock = translatedBlocks.get(blockId);
      
      if (translatedBlock) {
        content += '| Original | Translation |\n';
        content += '|----------|-------------|\n';
        content += `| ${translatedBlock.original.replace(/\|/g, '\\|')} | ${translatedBlock.translation.replace(/\|/g, '\\|')} |\n\n`;
      } else {
        content += line + '\n';
      }
      
      blockIndex++;
    }
    
    return {
      content,
      filename: `${originalDocument.task_id}_bilingual.md`,
      mimeType: 'text/markdown',
      size: new Blob([content]).size
    };
  }

  /**
   * Export as JSON with structured data
   */
  private static exportAsJSON(
    originalDocument: DocumentResult,
    translatedBlocks: Map<string, { translation: string; original: string }>,
    options: TranslationExportOptions
  ): TranslationExportResult {
    const exportData = {
      document: {
        task_id: originalDocument.task_id,
        original_content: originalDocument.markdown_content,
        metadata: originalDocument.metadata
      },
      translations: Array.from(translatedBlocks.entries()).map(([blockId, block]) => ({
        block_id: blockId,
        original: block.original,
        translation: block.translation
      })),
      export_metadata: {
        export_date: new Date().toISOString(),
        export_options: options,
        blocks_translated: translatedBlocks.size,
        tool: 'MonkeyOCR AI Translation'
      }
    };

    const content = JSON.stringify(exportData, null, 2);
    
    return {
      content,
      filename: `${originalDocument.task_id}_translation_data.json`,
      mimeType: 'application/json',
      size: new Blob([content]).size
    };
  }

  /**
   * Download exported content
   */
  static downloadExport(exportResult: TranslationExportResult): void {
    const blob = new Blob([exportResult.content], { type: exportResult.mimeType });
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = exportResult.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(url);
  }

  /**
   * Helper function to escape HTML
   */
  private static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export utility functions
export const exportTranslatedDocument = async (
  originalDocument: DocumentResult,
  translatedBlocks: Map<string, { translation: string; original: string }>,
  options: TranslationExportOptions
): Promise<void> => {
  try {
    const result = await TranslationExporter.exportTranslation(
      originalDocument,
      translatedBlocks,
      options
    );
    
    TranslationExporter.downloadExport(result);
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
};

export const getExportPreview = async (
  originalDocument: DocumentResult,
  translatedBlocks: Map<string, { translation: string; original: string }>,
  options: TranslationExportOptions
): Promise<string> => {
  const result = await TranslationExporter.exportTranslation(
    originalDocument,
    translatedBlocks,
    options
  );
  
  return result.content.substring(0, 1000) + (result.content.length > 1000 ? '...' : '');
};