"use client";

import React from 'react';
import { Switch } from './switch';
import { Slider } from './slider';
import { Label } from './label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Sparkles, Settings } from 'lucide-react';

interface LinkSuggestionSettingsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  minConfidence: number;
  onMinConfidenceChange: (confidence: number) => void;
  className?: string;
}

export function LinkSuggestionSettings({
  enabled,
  onEnabledChange,
  minConfidence,
  onMinConfidenceChange,
  className = ''
}: LinkSuggestionSettingsProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Link Suggestions
        </CardTitle>
        <CardDescription className="text-xs">
          Automatically suggest pages to link while you write
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="link-suggestions-enabled" className="text-sm font-medium">
            Enable suggestions
          </Label>
          <Switch
            id="link-suggestions-enabled"
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
        </div>

        {/* Confidence Threshold */}
        {enabled && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Suggestion sensitivity
              </Label>
              <span className="text-xs text-muted-foreground">
                {Math.round(minConfidence * 100)}%
              </span>
            </div>
            
            <Slider
              value={[minConfidence]}
              onValueChange={(values) => onMinConfidenceChange(values[0])}
              min={0.1}
              max={0.9}
              step={0.1}
              className="w-full"
            />
            
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>More suggestions</span>
              <span>Fewer suggestions</span>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Higher sensitivity shows more potential links, lower sensitivity shows only strong matches.
            </p>
          </div>
        )}

        {/* Help Text */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Link suggestions analyze your text and recommend pages to link to. 
            You can dismiss suggestions you don't want to see again during this session.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
