/**
 * FilePreview Component - BACKUP
 * Original implementation using react-pdf
 * Handles PDF and image file previews using react-pdf and native image rendering
 */

import React, { useState, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Import react-pdf styles to fix TextLayer warning
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { 
  RotateCw,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { ProcessingTask, BlockData, BlockSelection } from '../types';
import { syncManager } from '../utils/syncManager';
import { PDFBlockOverlay } from './pdf/PDFBlockOverlay';
import { ImageBlockOverlay } from './image/ImageBlockOverlay';
import { getAccessToken } from '../utils/auth';

// Set up PDF.js worker for Vite
// Use local worker file copied by vite-plugin-static-copy
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

// This is a backup of the original FilePreview component
// Created before migrating to embed-pdf-viewer
// Date: 2025-08-16