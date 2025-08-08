
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import UploadZone from '@/components/UploadZone';
import TaskList from '@/components/TaskList';
import DocumentViewer from '@/components/DocumentViewer';
import { useAppStore } from '@/store/appStore';
import { useState, useEffect } from 'react';

export function MainContent() {
  const { taskListVisible } = useAppStore();
  const [minSizePercent, setMinSizePercent] = useState(22);

  // 动态计算最小宽度百分比，确保不小于280px
  useEffect(() => {
    const updateMinSize = () => {
      const windowWidth = window.innerWidth;
      // 计算280px对应的百分比，并设置合理的边界
      const minPercent = Math.max(20, Math.min(35, (280 / windowWidth) * 100));
      setMinSizePercent(minPercent);
    };

    updateMinSize();
    window.addEventListener('resize', updateMinSize);
    return () => window.removeEventListener('resize', updateMinSize);
  }, []);

  // 🔧 修复：使用CSS Grid避免组件实例重新创建，保持DocumentViewer稳定
  return (
    <div 
      className="h-full transition-all duration-300 ease-in-out"
      style={{
        display: 'grid',
        gridTemplateColumns: taskListVisible ? `${25}% 2px 1fr` : '0px 0px 1fr',
        gridTemplateRows: '1fr',
        height: '100%',
        overflow: 'hidden' // Contained overflow for layout only
      }}
    >
      {/* 任务列表区域 - 始终存在，通过Grid控制显示 */}
      <div 
        className={`bg-muted/10 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
          taskListVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          minWidth: taskListVisible ? `${minSizePercent}%` : '0px',
          height: '100%'
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
      
      {/* 分隔线 */}
      <div 
        className={`bg-border transition-all duration-300 ease-in-out ${
          taskListVisible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          width: taskListVisible ? '1px' : '0px',
          cursor: taskListVisible ? 'col-resize' : 'default'
        }}
      />
      
      {/* DocumentViewer区域 - 始终在相同的Grid位置，保持组件实例稳定 */}
      <div>
        <DocumentViewer key="stable-document-viewer" className="h-full" />
      </div>
    </div>
  );
}
