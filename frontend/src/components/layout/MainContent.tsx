
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import UploadZone from '@/components/UploadZone';
import TaskList from '@/components/TaskList';
import DocumentViewer from '@/components/DocumentViewer';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

export function MainContent() {
  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="flex-1 overflow-hidden"
    >
      <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
        <div className="h-full bg-muted/10 flex flex-col">
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
        </div>
      </ResizablePanel>
      
      <ResizableHandle withHandle />
      
      <ResizablePanel defaultSize={75}>
        <DocumentViewer className="h-full" />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
