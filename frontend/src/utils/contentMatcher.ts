import { ProcessingBlock } from '@/types';

/**
 * Advanced content matching algorithms for synchronizing JSON blocks with Markdown sections
 * Implements multiple matching strategies for robust block-to-content mapping
 */

export interface MatchResult {
  blockIndex: number;
  sectionIndex: number;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'position' | 'semantic';
}

export interface MatchingOptions {
  exactMatchThreshold: number;
  fuzzyMatchThreshold: number;
  positionWeight: number;
  semanticWeight: number;
  enableSemanticMatching: boolean;
}

const DEFAULT_MATCHING_OPTIONS: MatchingOptions = {
  exactMatchThreshold: 0.95,
  fuzzyMatchThreshold: 0.6,
  positionWeight: 0.3,
  semanticWeight: 0.4,
  enableSemanticMatching: true
};

/**
 * Main content matching function
 * Maps JSON blocks to Markdown sections using multiple strategies
 */
export function matchBlocksToSections(
  blocks: ProcessingBlock[],
  markdownSections: string[],
  options: Partial<MatchingOptions> = {}
): Map<number, MatchResult> {
  const opts = { ...DEFAULT_MATCHING_OPTIONS, ...options };
  const matches = new Map<number, MatchResult>();
  
  // Preprocess sections
  const processedSections = markdownSections.map(preprocessSection);
  const processedBlocks = blocks.map(preprocessBlock);
  
  // Track used sections to avoid duplicates
  const usedSections = new Set<number>();
  
  // Strategy 1: Exact matching
  const exactMatches = findExactMatches(processedBlocks, processedSections, opts.exactMatchThreshold);
  exactMatches.forEach((match, blockIndex) => {
    if (!usedSections.has(match.sectionIndex)) {
      matches.set(blockIndex, match);
      usedSections.add(match.sectionIndex);
    }
  });
  
  // Strategy 2: Fuzzy matching for remaining blocks
  const remainingBlocks = processedBlocks.filter((_, index) => !matches.has(index));
  const remainingSections = processedSections.filter((_, index) => !usedSections.has(index));
  
  if (remainingBlocks.length > 0 && remainingSections.length > 0) {
    const fuzzyMatches = findFuzzyMatches(
      remainingBlocks, 
      remainingSections, 
      blocks,
      markdownSections,
      opts.fuzzyMatchThreshold
    );
    
    fuzzyMatches.forEach((match, originalBlockIndex) => {
      const actualSectionIndex = markdownSections.findIndex(
        (section, index) => !usedSections.has(index) && 
        preprocessSection(section) === remainingSections[match.sectionIndex]
      );
      
      if (actualSectionIndex >= 0) {
        matches.set(originalBlockIndex, {
          ...match,
          sectionIndex: actualSectionIndex
        });
        usedSections.add(actualSectionIndex);
      }
    });
  }
  
  // Strategy 3: Position-based inference for unmatched blocks
  const stillUnmatchedBlocks = blocks.filter((_, index) => !matches.has(index));
  if (stillUnmatchedBlocks.length > 0) {
    const positionMatches = inferPositionMatches(
      blocks,
      markdownSections,
      matches,
      usedSections
    );
    
    positionMatches.forEach((match, blockIndex) => {
      if (!matches.has(blockIndex)) {
        matches.set(blockIndex, match);
      }
    });
  }
  
  return matches;
}

/**
 * Find exact matches between blocks and sections
 */
function findExactMatches(
  processedBlocks: string[],
  processedSections: string[],
  threshold: number
): Map<number, MatchResult> {
  const matches = new Map<number, MatchResult>();
  
  processedBlocks.forEach((blockContent, blockIndex) => {
    if (!blockContent) return;
    
    processedSections.forEach((sectionContent, sectionIndex) => {
      if (!sectionContent) return;
      
      const similarity = calculateStringSimilarity(blockContent, sectionContent);
      
      if (similarity >= threshold) {
        matches.set(blockIndex, {
          blockIndex,
          sectionIndex,
          confidence: similarity,
          matchType: 'exact'
        });
      }
    });
  });
  
  return matches;
}

/**
 * Find fuzzy matches using advanced text comparison
 */
function findFuzzyMatches(
  remainingProcessedBlocks: string[],
  remainingProcessedSections: string[],
  originalBlocks: ProcessingBlock[],
  _originalSections: string[],
  threshold: number
): Map<number, MatchResult> {
  const matches = new Map<number, MatchResult>();
  
  for (let blockIdx = 0; blockIdx < remainingProcessedBlocks.length; blockIdx++) {
    const blockContent = remainingProcessedBlocks[blockIdx];
    if (!blockContent) continue;
    
    let bestMatch: MatchResult | null = null;
    let bestConfidence = 0;
    
    for (let sectionIdx = 0; sectionIdx < remainingProcessedSections.length; sectionIdx++) {
      const sectionContent = remainingProcessedSections[sectionIdx];
      if (!sectionContent) continue;
      
      // Multiple similarity measures
      const jaccardSim = calculateJaccardSimilarity(blockContent, sectionContent);
      const editDistSim = calculateEditDistanceSimilarity(blockContent, sectionContent);
      const wordOverlapSim = calculateWordOverlapSimilarity(blockContent, sectionContent);
      
      // Weighted combination of similarity scores
      const combinedSimilarity = (jaccardSim * 0.4) + (editDistSim * 0.3) + (wordOverlapSim * 0.3);
      
      if (combinedSimilarity >= threshold && combinedSimilarity > bestConfidence) {
        // Find original block index
        const originalBlockIndex = originalBlocks.findIndex(
          block => preprocessBlock(block) === blockContent
        );
        
        if (originalBlockIndex >= 0) {
          bestMatch = {
            blockIndex: originalBlockIndex,
            sectionIndex: sectionIdx,
            confidence: combinedSimilarity,
            matchType: 'fuzzy'
          };
          bestConfidence = combinedSimilarity;
        }
      }
    }
    
    if (bestMatch) {
      matches.set(bestMatch.blockIndex, bestMatch);
    }
  }
  
  return matches;
}

/**
 * Infer matches based on document position and order
 */
function inferPositionMatches(
  blocks: ProcessingBlock[],
  sections: string[],
  existingMatches: Map<number, MatchResult>,
  usedSections: Set<number>
): Map<number, MatchResult> {
  const matches = new Map<number, MatchResult>();
  
  // Sort blocks by their order in document
  const sortedBlocks = blocks
    .map((block, index) => ({ block, originalIndex: index }))
    .filter(item => !existingMatches.has(item.originalIndex))
    .sort((a, b) => {
      // Sort by page first, then by vertical position (bbox y-coordinate)
      const pageA = a.block.lines[0]?.spans[0]?.bbox[1] || 0;
      const pageB = b.block.lines[0]?.spans[0]?.bbox[1] || 0;
      return pageA - pageB;
    });
  
  // Available sections (not yet matched)
  const availableSectionIndexes = sections
    .map((_, index) => index)
    .filter(index => !usedSections.has(index));
  
  // Simple position-based assignment
  sortedBlocks.forEach((item, relativeIndex) => {
    if (relativeIndex < availableSectionIndexes.length) {
      const sectionIndex = availableSectionIndexes[relativeIndex];
      
      matches.set(item.originalIndex, {
        blockIndex: item.originalIndex,
        sectionIndex,
        confidence: 0.5, // Lower confidence for position-based matches
        matchType: 'position'
      });
    }
  });
  
  return matches;
}

/**
 * Preprocess a block to extract its text content
 */
function preprocessBlock(block: ProcessingBlock): string {
  const content = block.lines
    .flatMap(line => line.spans.map(span => span.content))
    .join(' ');
    
  return normalizeText(content);
}

/**
 * Preprocess a markdown section for comparison
 */
function preprocessSection(section: string): string {
  // Remove markdown formatting
  const cleanSection = section
    .replace(/[#*_`\[\]]/g, '') // Remove markdown markers
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // Remove image references
    .replace(/\[[^\]]*\]\([^)]*\)/g, '') // Remove links
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]*`/g, ''); // Remove inline code
    
  return normalizeText(cleanSection);
}

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s\u4e00-\u9fff]/g, '') // Keep only alphanumeric and Chinese characters
    .trim()
    .toLowerCase();
}

/**
 * Calculate string similarity using character-level comparison
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  const editDistance = calculateLevenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Jaccard similarity between two text strings
 */
function calculateJaccardSimilarity(str1: string, str2: string): number {
  const set1 = new Set(str1.split(/\s+/).filter(w => w.length > 1));
  const set2 = new Set(str2.split(/\s+/).filter(w => w.length > 1));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Calculate edit distance similarity
 */
function calculateEditDistanceSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  
  const distance = calculateLevenshteinDistance(str1, str2);
  return (maxLen - distance) / maxLen;
}

/**
 * Calculate word overlap similarity
 */
function calculateWordOverlapSimilarity(str1: string, str2: string): number {
  const words1 = str1.split(/\s+/).filter(w => w.length > 2);
  const words2 = str2.split(/\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 && words2.length === 0) return 1;
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const overlap = words1.filter(word => words2.includes(word)).length;
  return overlap / Math.max(words1.length, words2.length);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function calculateLevenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null)
  );
  
  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }
  
  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Export utility functions for external use
 */
export {
  preprocessBlock,
  preprocessSection,
  normalizeText,
  calculateStringSimilarity,
  calculateJaccardSimilarity
};