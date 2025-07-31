import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Separator } from './components/ui/separator';
import { Badge } from './components/ui/badge';
import UploadZone from './components/UploadZone';
import TaskList from './components/TaskList';
import DocumentViewer from './components/DocumentViewer';
import { useAppStore } from './store/appStore';
import './App.css';

function App() {
  const { tasks, isProcessing } = useAppStore();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold">MonkeyOCR WebApp</h1>
              <Badge variant="outline">Phase 2</Badge>
            </div>
            
            <div className="flex items-center space-x-2">
              {isProcessing && (
                <Badge variant="secondary" className="animate-pulse">
                  Processing...
                </Badge>
              )}
              <Badge variant="outline">
                {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Upload and Tasks */}
          <div className="lg:col-span-1 space-y-6">
            {/* Upload Zone */}
            <Card>
              <CardHeader>
                <CardTitle>Upload Files</CardTitle>
              </CardHeader>
              <CardContent>
                <UploadZone />
              </CardContent>
            </Card>

            {/* Task List */}
            <TaskList maxHeight="600px" />
          </div>

          {/* Right Column - Document Viewer */}
          <div className="lg:col-span-2">
            <DocumentViewer />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>MonkeyOCR WebApp - OCR Content Extraction Platform</p>
            <p>Phase 2 Core Functionality Complete</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;