/**
 * ImageGallery Component
 * Displays extracted images with preview functionality
 */

import React, { useState } from 'react';
import { Image, Maximize2, X } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { getMediaFileUrl } from '../../config';
import type { ImageResource } from '../../types';

interface ImageGalleryProps {
  images: ImageResource[];
  className?: string;
}

export const ImageGallery: React.FC<ImageGalleryProps> = React.memo(({
  images,
  className = ""
}) => {
  const [selectedImage, setSelectedImage] = useState<ImageResource | null>(null);

  const handleImageClick = (image: ImageResource) => {
    setSelectedImage(image);
  };

  const getImageUrl = (url: string) => {
    return url.startsWith('http') 
      ? url 
      : getMediaFileUrl(url.replace('/media/', ''));
  };

  if (images.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">此文档中未找到图片</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className={`h-full w-full ${className}`}>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-3">
          {images.map((image, index) => (
            <div
              key={index}
              className="group relative aspect-square overflow-hidden rounded border bg-muted cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => handleImageClick(image)}
            >
              <img
                src={getImageUrl(image.url)}
                alt={image.alt || image.filename}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  console.error('Image failed to load:', image.url);
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-1">
                <p className="text-xs truncate">{image.filename}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Image preview dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedImage?.filename}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedImage(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          {selectedImage && (
            <div className="flex items-center justify-center">
              <img
                src={getImageUrl(selectedImage.url)}
                alt={selectedImage.alt || selectedImage.filename}
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
                onError={() => {
                  console.error('Modal image failed to load:', selectedImage.url);
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
});