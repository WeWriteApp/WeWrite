'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { isAdmin } from '../../utils/isAdmin';
import { Button } from '../../components/ui/button';
import { useToast } from '../../components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
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
    console.log('🖼️ [Upload] File upload triggered');
    const file = event.target.files?.[0];
    if (!file) {
      console.log('🖼️ [Upload] No file selected');
      return;
    }

    console.log('🖼️ [Upload] File selected:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('order', String(images.length));

      console.log('🖼️ [Upload] Sending request to API...');
      const response = await fetch('/api/admin/background-images', {
        method: 'POST',
        body: formData
      });

      console.log('🖼️ [Upload] API response status:', response.status);
      const data = await response.json();
      console.log('🖼️ [Upload] API response data:', data);

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
    <div className="min-h-screen bg-background">
      <div className="py-6 px-4 container mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin')}
              className="gap-2"
            >
              <Icon name="ArrowLeft" size={16} />
              Back to Admin
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Default Background Images</h1>
              <p className="text-muted-foreground">
                Manage default background images available to all users
              </p>
            </div>
            
            <div className="flex items-center gap-2">
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
                className="gap-2"
              >
                {uploading ? (
                  <Icon name="Loader" />
                ) : (
                  <Icon name="Plus" size={16} />
                )}
                Upload Image
              </Button>
            </div>
          </div>
        </div>

        {/* Images Grid */}
        <div className="space-y-4">
          {images.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Icon name="Image" size={48} className=" mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No background images</h3>
                <p className="text-muted-foreground mb-4">
                  Upload your first default background image to get started
                </p>
                <Button
                  onClick={() => document.getElementById('image-upload')?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  <Icon name="Upload" size={16} />
                  Upload Image
                </Button>
              </CardContent>
            </Card>
          ) : (
            images.map((image) => (
              <Card
                key={image.id}
                className={`transition-all duration-200 ${
                  draggedItem === image.id ? 'opacity-50' : ''
                }`}
                draggable
                onDragStart={(e) => handleDragStart(e, image.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, image.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Drag Handle */}
                    <div className="cursor-move text-muted-foreground">
                      <Icon name="GripVertical" size={20} />
                    </div>

                    {/* Image Preview */}
                    <div className="w-20 h-12 rounded-lg overflow-hidden bg-muted">
                      <img
                        src={image.url}
                        alt={image.filename}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Image Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{image.filename}</h3>
                        <Badge variant={image.active ? "default" : "secondary"}>
                          {image.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Uploaded by {image.uploadedBy} • {new Date(image.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={image.active}
                          onCheckedChange={(checked) => handleActiveToggle(image.id, checked)}
                        />
                        <span className="text-sm text-muted-foreground">
                          {image.active ? <Icon name="Eye" size={16} /> : <Icon name="EyeOff" size={16} />}
                        </span>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(image.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Icon name="Trash2" size={16} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Instructions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• <strong>Upload:</strong> Click "Upload Image" to add new default background images</p>
            <p>• <strong>Reorder:</strong> Drag and drop images to change their display order</p>
            <p>• <strong>Toggle:</strong> Use the switch to activate/deactivate images for users</p>
            <p>• <strong>Delete:</strong> Click the trash icon to permanently remove an image</p>
            <p>• <strong>File Requirements:</strong> Images should be under 5MB and in common formats (PNG, JPG, WebP)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
