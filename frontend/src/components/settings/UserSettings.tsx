/**
 * User Settings Component
 * Allows users to configure translation preferences and AI model settings
 */

import React, { useState, useEffect } from 'react';
import { Settings2, Languages, Sparkles, Globe, Zap, Brain } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useUserPreferencesStore } from '@/store/userPreferencesStore';
import { llmWrapper } from '@/lib/llmwrapper';
import { mtTranslationService } from '@/services/mtTranslationService';

interface UserSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LLMModel {
  id: string;
  name: string;
}

export const UserSettings: React.FC<UserSettingsProps> = ({ isOpen, onClose }) => {
  const {
    translationEngine,
    llmModel,
    preferredLanguage,
    setTranslationEngine,
    setLLMModel,
    setPreferredLanguage,
    resetToDefaults,
  } = useUserPreferencesStore();

  const [llmModels, setLLMModels] = useState<LLMModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [mtAvailable, setMtAvailable] = useState(true);

  // Load available LLM models
  useEffect(() => {
    if (isOpen) {
      loadLLMModels();
      checkMTAvailability();
    }
  }, [isOpen]);

  const loadLLMModels = async () => {
    setIsLoadingModels(true);
    try {
      const models = await llmWrapper.getModels();
      const formattedModels = models.map(m => ({
        id: m.id,
        name: m.id.split('/').pop() || m.id // Extract model name from ID
      }));
      setLLMModels(formattedModels);
      
      // If no model is selected, select the first one
      if (!llmModel && formattedModels.length > 0) {
        setLLMModel(formattedModels[0].id);
      }
    } catch (error) {
      console.error('Failed to load LLM models:', error);
      toast.error('获取模型列表失败');
      // Set fallback model
      setLLMModels([{ id: 'google/gemini-2.5-flash-lite', name: 'gemini-2.5-flash-lite' }]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const checkMTAvailability = async () => {
    try {
      const isHealthy = await mtTranslationService.checkHealth();
      setMtAvailable(isHealthy);
    } catch (error) {
      console.error('MT health check failed:', error);
      setMtAvailable(false);
    }
  };

  const handleSave = () => {
    toast.success('设置已保存', { duration: 2000 });
    onClose();
  };

  const handleReset = () => {
    resetToDefaults();
    toast.info('已恢复默认设置', { duration: 2000 });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[720px] max-h-[85vh]">
        <div className="flex flex-col h-full overflow-y-auto">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              用户设置
            </DialogTitle>
            <DialogDescription>
              配置AI模型、翻译引擎和语言偏好
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 lg:grid-cols-2 flex-1 overflow-y-auto">
          {/* AI Model Configuration - Always visible */}
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="h-4 w-4" />
                AI 模型配置
              </CardTitle>
              <CardDescription className="text-xs">
                选择用于翻译和解释功能的 AI 模型
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="llm-model" className="text-sm">
                  模型选择
                </Label>
                <Select
                  value={llmModel || ''}
                  onValueChange={setLLMModel}
                  disabled={isLoadingModels}
                >
                  <SelectTrigger id="llm-model">
                    <SelectValue placeholder={isLoadingModels ? "加载中..." : "选择AI模型"} />
                  </SelectTrigger>
                  <SelectContent>
                    {llmModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  此模型将用于：AI翻译模式、解释功能、表格和图片内容处理
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Translation Settings */}
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Languages className="h-4 w-4" />
                翻译设置
              </CardTitle>
              <CardDescription className="text-xs">
                配置翻译引擎和默认语言
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Translation Engine Toggle */}
              <div className="space-y-3">
                <Label htmlFor="translation-engine-toggle" className="text-sm">
                  翻译引擎
                </Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 rounded-lg border bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-blue-500" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">机器翻译</span>
                          {!mtAvailable && (
                            <span className="text-xs text-orange-500">不可用</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">快速</p>
                      </div>
                    </div>
                    
                    <Switch
                      id="translation-engine-toggle"
                      checked={translationEngine === 'llm'}
                      onCheckedChange={(checked) => setTranslationEngine(checked ? 'llm' : 'mt')}
                      disabled={!mtAvailable && translationEngine === 'mt'}
                    />
                    
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-xs font-medium">AI翻译</div>
                        <p className="text-xs text-muted-foreground">智能</p>
                      </div>
                      <Sparkles className="h-4 w-4 text-purple-500" />
                    </div>
                  </div>
                </div>

                {/* Engine Capabilities Info - Compact version */}
                <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
                  {translationEngine === 'mt' ? (
                    <div>
                      <div className="font-medium mb-1">机器翻译</div>
                      <ul className="space-y-0.5">
                        <li>• 速度快，批量处理</li>
                        <li>• 仅中英互译</li>
                        <li>• 复杂内容自动切换AI</li>
                      </ul>
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium mb-1">AI 翻译</div>
                      <ul className="space-y-0.5">
                        <li>• 支持所有语言</li>
                        <li>• 处理复杂内容</li>
                        <li>• 理解上下文</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Preferred Language */}
              <div className="space-y-2">
                <Label htmlFor="preferred-language" className="text-sm flex items-center gap-2">
                  <Globe className="h-3 w-3" />
                  默认目标语言
                </Label>
                <Select
                  value={preferredLanguage}
                  onValueChange={(value: 'zh' | 'en' | 'auto') => setPreferredLanguage(value)}
                >
                  <SelectTrigger id="preferred-language">
                    <SelectValue placeholder="选择默认语言" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">自动检测</SelectItem>
                    <SelectItem value="zh">中文</SelectItem>
                    <SelectItem value="en">英文</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  自动检测将根据源文本语言智能选择翻译方向
                </p>
              </div>
            </CardContent>
          </Card>
          </div>

          {/* Footer with proper spacing */}
          <div className="flex-shrink-0 mt-6 pt-4 pb-6 border-t">
            <DialogFooter className="gap-2 sm:gap-0">
              <div className="w-full flex flex-col sm:flex-row gap-2 sm:justify-between">
                <Button 
                  variant="outline" 
                  onClick={handleReset}
                  className="w-full sm:w-auto"
                >
                  恢复默认
                </Button>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    onClick={onClose}
                    className="flex-1 sm:flex-none"
                  >
                    取消
                  </Button>
                  <Button 
                    onClick={handleSave}
                    className="flex-1 sm:flex-none"
                  >
                    保存
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};