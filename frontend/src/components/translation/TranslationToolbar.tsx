import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { 
  Languages, 
  Settings, 
  Play, 
  Square, 
  Trash2, 
  RefreshCw,
  Loader2
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '../ui/dropdown-menu';
import { useToast } from '../../hooks/use-toast';
import { useTranslationActions, useTranslationState } from '../../store/appStore';
import { llmWrapper } from '../../lib/llmwrapper';

interface TranslationToolbarProps {
  onTranslate: () => void;
  isTranslating: boolean;
  hasTranslations: boolean;
  className?: string;
}

export const TranslationToolbar: React.FC<TranslationToolbarProps> = ({
  onTranslate,
  isTranslating,
  hasTranslations,
  className = ''
}) => {
  const { toast } = useToast();
  const {
    updateTranslationSettings,
    clearTranslations,
    loadAvailableModels
  } = useTranslationActions();
  
  const {
    translationSettings,
    availableModels,
    currentTranslationTask
  } = useTranslationState();

  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const supportedLanguages = llmWrapper.getSupportedLanguages();

  useEffect(() => {
    // Load available models on component mount
    handleLoadModels();
  }, []);

  const handleLoadModels = async () => {
    setIsLoadingModels(true);
    try {
      await loadAvailableModels();
      toast({
        title: "Models loaded",
        description: "Available translation models have been updated.",
      });
    } catch (error) {
      toast({
        title: "Failed to load models",
        description: "Could not fetch available models. Using default model.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleClearTranslations = () => {
    clearTranslations();
    toast({
      title: "Translations cleared",
      description: "All translation results have been removed.",
    });
  };

  const handleTranslationToggle = () => {
    if (isTranslating && currentTranslationTask) {
      // TODO: Implement stop translation functionality
      toast({
        title: "Translation stopping",
        description: "Current translation will stop after the current block.",
        variant: "destructive",
      });
    } else {
      onTranslate();
    }
  };

  const sourceLanguageOptions = supportedLanguages.filter(lang => 
    lang.code === 'auto' || lang.code !== translationSettings.targetLanguage
  );

  const targetLanguageOptions = supportedLanguages.filter(lang => 
    lang.code !== 'auto' && lang.code !== translationSettings.sourceLanguage
  );

  return (
    <Card className={`p-4 space-y-4 ${className}`}>
      {/* Main Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Languages className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Translation</h3>
          {isTranslating && (
            <Badge variant="secondary" className="flex items-center space-x-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Translating...</span>
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTranslationToggle}
            disabled={!translationSettings.sourceLanguage || !translationSettings.targetLanguage}
          >
            {isTranslating ? (
              <>
                <Square className="h-4 w-4 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Translate
              </>
            )}
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Translation Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={handleLoadModels} disabled={isLoadingModels}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingModels ? 'animate-spin' : ''}`} />
                Refresh Models
              </DropdownMenuItem>
              
              {hasTranslations && (
                <DropdownMenuItem onClick={handleClearTranslations}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Translations
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Language Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="source-language">From</Label>
          <Select 
            value={translationSettings.sourceLanguage} 
            onValueChange={(value) => updateTranslationSettings({ sourceLanguage: value })}
          >
            <SelectTrigger id="source-language">
              <SelectValue placeholder="Select source language">
                {translationSettings.sourceLanguage && (
                  <span className="flex items-center space-x-2">
                    <span>{supportedLanguages.find(l => l.code === translationSettings.sourceLanguage)?.flag}</span>
                    <span>{supportedLanguages.find(l => l.code === translationSettings.sourceLanguage)?.native_name}</span>
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {sourceLanguageOptions.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  <span className="flex items-center space-x-2">
                    <span>{lang.flag}</span>
                    <span>{lang.native_name}</span>
                    <span className="text-muted-foreground">({lang.name})</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="target-language">To</Label>
          <Select 
            value={translationSettings.targetLanguage} 
            onValueChange={(value) => updateTranslationSettings({ targetLanguage: value })}
          >
            <SelectTrigger id="target-language">
              <SelectValue placeholder="Select target language">
                {translationSettings.targetLanguage && (
                  <span className="flex items-center space-x-2">
                    <span>{supportedLanguages.find(l => l.code === translationSettings.targetLanguage)?.flag}</span>
                    <span>{supportedLanguages.find(l => l.code === translationSettings.targetLanguage)?.native_name}</span>
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {targetLanguageOptions.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  <span className="flex items-center space-x-2">
                    <span>{lang.flag}</span>
                    <span>{lang.native_name}</span>
                    <span className="text-muted-foreground">({lang.name})</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Model Selection */}
        {availableModels.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="model-select">Translation Model</Label>
            <Select 
              value={translationSettings.model || ''} 
              onValueChange={(value) => updateTranslationSettings({ model: value || undefined })}
            >
              <SelectTrigger id="model-select">
                <SelectValue placeholder="Default model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  <span className="text-muted-foreground">Use default model</span>
                </SelectItem>
                {availableModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Translation Options */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="streaming-toggle">Streaming Translation</Label>
            <Switch
              id="streaming-toggle"
              checked={translationSettings.enableStreaming}
              onCheckedChange={(checked) => updateTranslationSettings({ enableStreaming: checked })}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="show-original-toggle">Show Original</Label>
            <Switch
              id="show-original-toggle"
              checked={translationSettings.showOriginal}
              onCheckedChange={(checked) => updateTranslationSettings({ showOriginal: checked })}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};