'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppBackground, type ImageBackground } from '@/contexts/AppBackgroundContext';
import { cn } from '@/lib/utils';

interface BackgroundImageUploadProps {
  className?: string;
  persistedImageUrl?: string | null;
  isLoading?: boolean;
}

export function BackgroundImageUpload({
  className,
  persistedImageUrl,
  isLoading = false
}: BackgroundImageUploadProps) {
  const { background, setBackground, lastUploadedImage, setLastUploadedImage } = useAppBackground();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use persisted image URL if available, otherwise fall back to context
  const currentUploadedImage = lastUploadedImage || persistedImageUrl;

  // Update context with persisted image when it's loaded
  useEffect(() => {
    if (persistedImageUrl && !lastUploadedImage) {
      setLastUploadedImage(persistedImageUrl);
    }
  }, [persistedImageUrl, lastUploadedImage, setLastUploadedImage]);

  const isImageBackground = background.type === 'image';

  const handleRemoveImage = async () => {
    if (!isImageBackground) return;

    try {
      const response = await fetch('/api/upload/background', {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        // Reset to default background
        setBackground({
          type: 'solid',
          color: '#ffffff',
          darkColor: '#000000',
          oklchLight: '100.00% 0.0000 158.2',
          oklchDark: '0.00% 0.0000 0.0'
        });
      }
    } catch (error) {
      console.error('Failed to remove background image:', error);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log(`[Background Upload] Starting upload for file: ${file.name} (${file.size} bytes, ${file.type})`);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.log('[Background Upload] Invalid file type:', file.type);
      setUploadError('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      console.log('[Background Upload] File too large:', file.size);
      setUploadError('Image must be smaller than 10MB');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // Create FormData for upload
      console.log('[Background Upload] Creating form data...');
      const formData = new FormData();
      formData.append('image', file);

      // Upload to our API endpoint
      console.log('[Background Upload] Sending request to API...');
      const response = await fetch('/api/upload/background', {
        method: 'POST',
        body: formData,
        credentials: 'include' // Include cookies for authentication
      });

      console.log(`[Background Upload] API response status: ${response.status}`);

      if (!response.ok) {
        let errorMessage = 'Failed to upload image';
        let responseText = '';
        try {
          // First try to get the raw response text
          responseText = await response.text();
          console.log('[Background Upload] Raw error response:', responseText);

          // Try to parse as JSON
          if (responseText) {
            const errorData = JSON.parse(responseText);
            console.error('[Background Upload] API error response:', errorData);
            errorMessage = errorData.error || errorData.message || errorData.data?.message || errorMessage;
          } else {
            errorMessage = `Upload failed with status ${response.status} (empty response)`;
          }
        } catch (parseError) {
          console.error('[Background Upload] Failed to parse error response:', parseError);
          console.error('[Background Upload] Raw response text:', responseText);
          errorMessage = `Upload failed with status ${response.status} (parse error: ${parseError.message})`;
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      console.log('[Background Upload] API success response:', responseData);

      const url = responseData.data?.url || responseData.url;
      if (!url) {
        throw new Error('No URL returned from upload');
      }

      // Store the uploaded image for persistence
      setLastUploadedImage(url);

      // Set the new background image
      const newBackground: ImageBackground = {
        type: 'image',
        url: url,
        opacity: 0.15 // Default opacity
      };

      setBackground(newBackground);

      // Save the preference to ensure it persists across sessions
      try {
        await fetch('/api/user/background-preference', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            backgroundType: 'image',
            backgroundData: newBackground
          })
        });
        console.log('[Background Upload] Background preference saved');
      } catch (prefError) {
        console.warn('[Background Upload] Failed to save background preference:', prefError);
        // Don't fail the upload if preference saving fails
      }

      console.log('[Background Upload] Upload completed successfully');
    } catch (error) {
      console.error('[Background Upload] Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload image. Please try again.';
      setUploadError(errorMessage);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };



  return (
    <div className={cn("space-y-3", className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Current state display */}
      {isImageBackground ? (
        <div className="space-y-3">
          {/* Image preview */}
          <div className="relative rounded-lg overflow-hidden border border-border">
            <img
              src={background.url}
              alt="Background preview"
              className="w-full h-24 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-2 left-2 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-white" />
              <span className="text-xs text-white font-medium">Custom Background</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleUploadClick}
              disabled={isUploading}
              className="flex-1"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? 'Uploading...' : 'Change Image'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRemoveImage}
              disabled={isUploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        /* Upload section for solid backgrounds */
        <div className="space-y-3">
          {/* Show uploaded image if available but not currently active */}
          {currentUploadedImage && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Your Uploaded Image</label>
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img
                  src={currentUploadedImage}
                  alt="Your uploaded background"
                  className="w-full h-20 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    // Set this as the active background
                    const imageBackground: ImageBackground = {
                      type: 'image',
                      url: currentUploadedImage,
                      opacity: 0.15
                    };
                    setBackground(imageBackground);
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                <div className="absolute bottom-1 left-2 flex items-center gap-1">
                  <ImageIcon className="h-3 w-3 text-white" />
                  <span className="text-xs text-white">Click to use</span>
                </div>
              </div>
            </div>
          )}

          {/* Upload button */}
          <Button
            variant="secondary"
            onClick={handleUploadClick}
            disabled={isUploading || isLoading}
            className="w-full h-12 border-dashed"
          >
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? 'Uploading...' : isLoading ? 'Loading...' : 'Upload Background Image'}
          </Button>
        </div>
      )}

      {/* Error message */}
      {uploadError && (
        <p className="text-sm text-destructive">{uploadError}</p>
      )}
    </div>
  );
}
