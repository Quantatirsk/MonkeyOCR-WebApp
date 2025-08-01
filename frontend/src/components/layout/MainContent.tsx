
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import UploadZone from '@/components/UploadZone';
import TaskList from '@/components/TaskList';
import DocumentViewer from '@/components/DocumentViewer';

export function MainContent() {
  return (
    <div className="flex-1 flex overflow-hidden">
      <aside className="w-80 border-r bg-muted/10 flex flex-col">
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

        <div className="flex-1 p-3 pt-2 min-h-0">
          <TaskList />
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">
        <DocumentViewer className="h-full" />
      </main>
    </div>
  );
}
