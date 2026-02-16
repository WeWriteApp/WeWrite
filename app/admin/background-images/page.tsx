'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { useToast } from '../../components/ui/use-toast';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';

interface DefaultBackgroundImage {
  id: string;
  filename: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  order: number;
  active: boolean;
}

export default function AdminBackgroundImagesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [images, setImages] = useState<DefaultBackgroundImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  // Check admin access - use user.isAdmin from auth context for consistency
  useEffect(() => {
    if (!authLoading && user) {
      if (!user.isAdmin) {
        router.push('/');
      }
    } else if (!authLoading && !user) {
      router.push('/auth/login?redirect=/admin/background-images');
    }
  }, [user, authLoading, router]);

  // Fetch background images
  const fetchImages = async () => {
    try {
      const response = await fetch('/api/admin/background-images');
      const data = await response.json();
      
      if (data.success) {
        setImages(data.images);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch background images",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error fetching images:', error);
      toast({
        title: "Error",
        description: "Failed to fetch background images",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.isAdmin) {
      fetchImages();
    }
  }, [user]);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }


    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('order', String(images.length));

      const response = await fetch('/api/admin/background-images', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Background image uploaded successfully"
        });
        fetchImages(); // Refresh the list
      } else {
        console.error('🖼️ [Upload] Upload failed:', data.error);
        toast({
          title: "Error",
          description: data.error || "Failed to upload image",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('🖼️ [Upload] Error uploading image:', error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  // Handle delete
  const handleDelete = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this background image?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/background-images?id=${imageId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Background image deleted successfully"
        });
        fetchImages(); // Refresh the list
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to delete image",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      toast({
        title: "Error",
        description: "Failed to delete image",
        variant: "destructive"
      });
    }
  };

  // Handle active toggle
  const handleActiveToggle = async (imageId: string, active: boolean) => {
    const updatedImages = images.map(img => 
      img.id === imageId ? { ...img, active } : img
    );

    try {
      const response = await fetch('/api/admin/background-images', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ images: updatedImages })
      });

      const data = await response.json();

      if (data.success) {
        setImages(updatedImages);
        toast({
          title: "Success",
          description: "Image status updated successfully"
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to update image status",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error updating image status:', error);
      toast({
        title: "Error",
        description: "Failed to update image status",
        variant: "destructive"
      });
    }
  };

  // Handle drag and drop reordering
  const handleDragStart = (e: React.DragEvent, imageId: string) => {
    setDraggedItem(imageId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetImageId: string) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem === targetImageId) {
      setDraggedItem(null);
      return;
    }

    const draggedIndex = images.findIndex(img => img.id === draggedItem);
    const targetIndex = images.findIndex(img => img.id === targetImageId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItem(null);
      return;
    }

    // Reorder images
    const newImages = [...images];
    const [draggedImage] = newImages.splice(draggedIndex, 1);
    newImages.splice(targetIndex, 0, draggedImage);

    // Update order values
    const updatedImages = newImages.map((img, index) => ({
      ...img,
      order: index
    }));

    try {
      const response = await fetch('/api/admin/background-images', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ images: updatedImages })
      });

      const data = await response.json();

      if (data.success) {
        setImages(updatedImages);
        toast({
          title: "Success",
          description: "Image order updated successfully"
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to update image order",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error updating image order:', error);
      toast({
        title: "Error",
        description: "Failed to update image order",
        variant: "destructive"
      });
    } finally {
      setDraggedItem(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Icon name="Loader" />
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Access denied. Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      <input
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
        id="image-upload"
        disabled={uploading}
      />
      <Button
        onClick={() => document.getElementById('image-upload')?.click()}
        disabled={uploading}
        size="sm"
        className="gap-1.5 w-full"
      >
        {uploading ? (
          <Icon name="Loader" size={14} />
        ) : (
          <Icon name="Plus" size={14} />
        )}
        Upload Image
      </Button>

      {/* Images List */}
      <div className="space-y-2">
        {images.length === 0 ? (
          <div className="wewrite-card text-center py-8">
            <Icon name="Image" size={32} className="mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium text-sm">No background images</p>
            <p className="text-xs text-muted-foreground mt-1">
              Upload your first image to get started
            </p>
          </div>
        ) : (
          images.map((image) => (
            <div
              key={image.id}
              className={`wewrite-card transition-all ${
                draggedItem === image.id ? 'opacity-50' : ''
              }`}
              draggable
              onDragStart={(e) => handleDragStart(e, image.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, image.id)}
            >
              <div className="flex items-center gap-3">
                {/* Drag Handle */}
                <div className="cursor-move text-muted-foreground flex-shrink-0">
                  <Icon name="GripVertical" size={16} />
                </div>

                {/* Image Preview */}
                <div className="w-14 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                  <img
                    src={image.url}
                    alt={image.filename}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Image Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{image.filename}</p>
                    <Badge variant={image.active ? "default" : "secondary"} className="text-xs flex-shrink-0">
                      {image.active ? "On" : "Off"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {image.uploadedBy} • {new Date(image.uploadedAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Switch
                    checked={image.active}
                    onCheckedChange={(checked) => handleActiveToggle(image.id, checked)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(image.id)}
                    className="text-destructive hover:text-destructive h-8 w-8 p-0"
                  >
                    <Icon name="Trash2" size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Instructions */}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground font-medium">
          Instructions
        </summary>
        <div className="mt-2 space-y-1 pl-2">
          <p>• Drag to reorder images</p>
          <p>• Toggle switch to activate/deactivate</p>
          <p>• Max 5MB, PNG/JPG/WebP</p>
        </div>
      </details>
    </div>
  );
}
