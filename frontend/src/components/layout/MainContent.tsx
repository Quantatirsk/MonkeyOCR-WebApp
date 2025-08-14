
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import UploadZone from '@/components/UploadZone';
import TaskList from '@/components/TaskList';
import DocumentViewer from '@/components/DocumentViewer';
import { useUIStore } from '@/store/uiStore';

export function MainContent() {
  // 使用独立的 UI Store，完全避免业务状态影响
  const taskListVisible = useUIStore(state => state.taskListVisible);

  return (
    <div 
      className="h-full relative overflow-hidden"
      style={{
        '--task-list-offset': taskListVisible ? '321px' : '0px'
      } as React.CSSProperties}
    >
      {/* DocumentViewer 始终占满全屏，作为底层 */}
      <div className="absolute inset-0">
        <DocumentViewer 
          key="stable-document-viewer" 
          className="h-full" 
        />
      </div>
      
      {/* 任务列表容器 - 使用 transform 移动，覆盖在 DocumentViewer 上 */}
      <div 
        className="absolute left-0 top-0 h-full bg-background border-r flex flex-col z-20 shadow-lg"
        style={{
          width: '320px',
          transform: taskListVisible ? 'translateX(0)' : 'translateX(-320px)',
          transition: 'transform 150ms ease-out',
          willChange: 'transform'
        }}
      >
        {/* 上传区域 */}
        <div className="flex-shrink-0 p-4 pb-2">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">上传文件</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <UploadZone />
            </CardContent>
          </Card>
        </div>

        {/* 任务列表 */}
        <div className="flex-1 px-4 pb-4 min-h-0 overflow-hidden">
          <TaskList className="h-full" />
        </div>
      </div>
    </div>
  );
}
