
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import UploadZone from '@/components/UploadZone';
import TaskList from '@/components/TaskList';
import DocumentViewer from '@/components/DocumentViewer';
import { useAppStore } from '@/store/appStore';

export function MainContent() {
  const { taskListVisible } = useAppStore();

  // 🔧 修复：使用固定宽度的Grid列，避免百分比导致的溢出问题
  return (
    <div 
      className="h-full transition-all duration-300 ease-in-out"
      style={{
        display: 'grid',
        // 使用固定宽度320px而不是百分比，避免溢出
        gridTemplateColumns: taskListVisible ? `320px 2px 1fr` : '0px 0px 1fr',
        gridTemplateRows: '1fr',
        height: '100%',
        overflow: 'hidden' // 主容器不滚动
      }}
    >
      {/* 任务列表区域 - 固定宽度320px */}
      <div 
        className={`bg-muted/10 flex flex-col transition-all duration-300 ease-in-out ${
          taskListVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          width: '100%', // 使用grid列的宽度
          height: '100%',
          overflowY: 'auto', // 只允许垂直滚动
          overflowX: 'hidden' // 不允许水平滚动
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
