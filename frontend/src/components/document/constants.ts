/**
 * Document Viewer Constants
 */

export const FONT_SIZES = [85, 100, 120] as const;
export const FONT_LABELS = ['小', '中', '大'] as const;

export const TAB_TYPES = {
  PREVIEW: 'preview',
  COMPARE: 'compare',
  TRANSLATION: 'translation',
  IMAGES: 'images',
  METADATA: 'metadata'
} as const;

export type TabType = typeof TAB_TYPES[keyof typeof TAB_TYPES];

export const TAB_CONFIG = [
  { id: TAB_TYPES.PREVIEW, label: '预览', icon: 'Monitor' },
  { id: TAB_TYPES.COMPARE, label: '对照', icon: 'ArrowLeftRight' },
  { id: TAB_TYPES.TRANSLATION, label: '翻译', icon: 'Languages' },
  { id: TAB_TYPES.IMAGES, label: '图片', icon: 'Image' },
  { id: TAB_TYPES.METADATA, label: '详情', icon: 'Eye' }
] as const;