import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import UploadZone from './components/UploadZone';
import TaskList from './components/TaskList';
import DocumentViewer from './components/DocumentViewer';
import ThemeToggle from './components/ThemeToggle';
import { Toaster } from './components/ui/toaster';
import { useAppStore } from './store/appStore';
import './App.css';

function App() {
  const { tasks, isProcessing } = useAppStore();

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header - 紧凑设计 */}
      <header className="h-12 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-lg font-semibold">MonkeyOCR</h1>
            <Badge variant="outline" className="text-xs">v2.0</Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            {isProcessing && (
              <Badge variant="secondary" className="animate-pulse text-xs">
                处理中...
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {tasks.length} 个任务
            </Badge>
            <ThemeToggle variant="icon" size="sm" />
          </div>
        </div>
      </header>

      {/* Main Layout - 响应式设计 */}
      <div className="flex-1 flex overflow-hidden pb-0 sm:pb-0">
        {/* Left Sidebar - 响应式宽度 */}
        <aside className="w-80 md:w-80 lg:w-96 border-r bg-muted/10 flex flex-col hidden sm:flex">
          {/* Upload Zone - 固定高度 */}
          <div className="flex-shrink-0 p-3 pb-0">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">上传文件</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <UploadZone />
              </CardContent>
            </Card>
          </div>

          {/* Task List - 占用剩余空间 */}
          <div className="flex-1 p-3 pt-2 min-h-0">
            <TaskList />
          </div>
        </aside>

        {/* Main Content Area - 移动端全宽，为底部面板留出空间 */}
        <main className="flex-1 overflow-hidden pb-48 sm:pb-0">
          <DocumentViewer className="h-full" />
        </main>
      </div>
      
      {/* Mobile Bottom Panel - 仅在小屏显示 */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
        <div className="p-2 h-48">
          <div className="flex space-x-2 h-full">
            {/* Upload Zone - 紧凑版 */}
            <div className="flex-1">
              <Card className="h-full">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs">上传</CardTitle>
                </CardHeader>
                <CardContent className="p-2 pt-0">
                  <UploadZone />
                </CardContent>
              </Card>
            </div>
            
            {/* Task List - 紧凑版 */}
            <div className="flex-1 overflow-hidden">
              <TaskList />
            </div>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}

export default App;