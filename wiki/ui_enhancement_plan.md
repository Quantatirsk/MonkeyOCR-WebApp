# UI Enhancement Implementation Plan

## Overview
This document outlines the implementation plan for three UI enhancement tasks:
1. Default to "对照" (Compare) tab when selecting tasks
2. Add floating action buttons in Compare view
3. Clean up and unify CSS theme system

## Current State Analysis

### Tab Navigation System
- **Current Behavior**: When a task is selected, the `activeDocumentTab` remains at its current value (default: 'preview')
- **Tab Types**: preview, compare, content, images, metadata
- **State Management**: `activeDocumentTab` is stored in appStore

### Translation/Explanation System
- **Implementation**: Uses custom events dispatched to markdown panel
- **Event Types**: 'translate-block', 'explain-block', 'translate-all'
- **Handler Functions**: `handleTranslateBlock`, `handleExplainBlock` in DocumentViewer

### Theme System
- **CSS Variables**: Defined in `index.css` for light and dark themes
- **State**: Managed in appStore with `theme` property and `toggleTheme` function
- **Current Gap**: No fullscreen functionality implemented

## Implementation Tasks

## Task 1: Default to Compare Tab

### Objective
When clicking on a file task, automatically switch to the "对照" (compare) tab.

### Implementation
```typescript
// In appStore.ts - Modify setCurrentTask function
setCurrentTask: (taskId) => {
  set({ 
    currentTaskId: taskId,
    activeDocumentTab: taskId ? 'compare' : get().activeDocumentTab
  });
},
```

### Files to Modify
- `/frontend/src/store/appStore.ts`: Line 132-134

## Task 2: Floating Action Bar

### Objective
Add a floating button group at the bottom center of the Compare view with:
- Fullscreen button
- Translate button
- Explain button

### Component Design
```typescript
interface FloatingActionBarProps {
  onFullscreen: () => void;
  onTranslate: () => void;
  onExplain: () => void;
  isFullscreen: boolean;
  className?: string;
}
```

### Features
1. **Position**: Fixed at bottom center of previewer area
2. **Style**: Tiny, elegant buttons matching existing UI
3. **Visibility**: Only shown in Compare tab
4. **Animations**: Smooth fade in/out transitions

### Fullscreen Implementation
```typescript
const handleFullscreen = () => {
  const element = document.querySelector('.document-viewer-container');
  if (!document.fullscreenElement) {
    element?.requestFullscreen();
    // Apply theme classes to fullscreen element
    element?.classList.add('bg-background', 'text-foreground');
  } else {
    document.exitFullscreen();
  }
};
```

### Files to Create
- `/frontend/src/components/document/FloatingActionBar.tsx`

### Files to Modify
- `/frontend/src/components/DocumentViewer.tsx`: Add FloatingActionBar component

## Task 3: CSS Theme Cleanup

### Objectives
1. Ensure consistent use of theme classes across all components
2. Fix fullscreen mode theme inheritance
3. Create utility classes for common patterns

### Theme Utility Classes
```css
/* Smooth theme transitions */
.theme-transition {
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* Fullscreen container with proper theme support */
.fullscreen-container {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

/* Floating action bar specific styles */
.floating-action-bar {
  @apply bg-background/95 backdrop-blur-sm border border-border;
}
```

### Components to Audit
- All components should use `bg-background` instead of hardcoded colors
- Text should use `text-foreground` or `text-muted-foreground`
- Borders should use `border-border`

### Files to Modify
- `/frontend/src/index.css`: Add utility classes
- Various component files for consistency

## Implementation Timeline

### Phase 1: Quick Wins (5 minutes)
- [x] Create wiki documentation
- [ ] Implement default tab change

### Phase 2: Core Feature (30 minutes)
- [ ] Create FloatingActionBar component
- [ ] Integrate with DocumentViewer
- [ ] Implement fullscreen functionality

### Phase 3: Polish (20 minutes)
- [ ] CSS theme cleanup
- [ ] Test theme consistency
- [ ] Mobile responsiveness

## Testing Checklist

### Functional Tests
- [ ] Clicking a task opens Compare tab
- [ ] Floating buttons appear only in Compare view
- [ ] Translate button triggers translation
- [ ] Explain button triggers explanation
- [ ] Fullscreen enters/exits properly

### Theme Tests
- [ ] Light theme displays correctly
- [ ] Dark theme displays correctly
- [ ] Theme persists in fullscreen
- [ ] Theme transitions are smooth

### Responsive Tests
- [ ] Mobile view (< 640px)
- [ ] Tablet view (640px - 1024px)
- [ ] Desktop view (> 1024px)

## Technical Considerations

### Browser Compatibility
- Fullscreen API: Supported in all modern browsers
- CSS Variables: Supported in all modern browsers
- Backdrop Filter: May need fallback for older browsers

### Performance
- Use React.memo for FloatingActionBar to prevent unnecessary re-renders
- Debounce fullscreen transitions
- Use CSS transforms for animations (GPU accelerated)

### Accessibility
- Add aria-labels to all buttons
- Ensure keyboard navigation works
- Maintain focus management in fullscreen

## Code Quality Standards
- TypeScript strict mode compliance
- Consistent naming conventions
- Proper component documentation
- Error boundary for fullscreen API failures