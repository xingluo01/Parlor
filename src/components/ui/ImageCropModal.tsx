import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Modal } from './Modal';
import { Button } from './Button';

interface ImageCropModalProps {
  imageSrc: string;
  onConfirm: (cropped: string) => void;
  onCancel: () => void;
}

async function cropToDataUrl(
  src: string,
  pixelCrop: Area,
  rotation: number,
  outputSize = 400
): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d')!;

  // Scale factor: we need to map pixelCrop (in natural image pixels) → outputSize
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  ctx.save();
  ctx.translate(outputSize / 2, outputSize / 2);
  ctx.rotate((rotation * Math.PI) / 180);

  // Draw the source crop region centered on the canvas
  ctx.drawImage(
    image,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    -outputSize / 2,
    -outputSize / 2,
    outputSize,
    outputSize
  );

  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.92);
}

export function ImageCropModal({ imageSrc, onConfirm, onCancel }: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    const dataUrl = await cropToDataUrl(imageSrc, croppedAreaPixels, rotation);
    onConfirm(dataUrl);
  };

  return (
    <Modal isOpen onClose={onCancel} title="Adjust Image" size="md">
      <div className="space-y-4">
        {/* Crop area */}
        <div className="relative h-72 rounded-lg overflow-hidden bg-dark-300">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom control */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-gray-400">Zoom</label>
            <span className="text-xs text-gray-500">{zoom.toFixed(2)}×</span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-parlor-500"
          />
        </div>

        {/* Rotation control */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-gray-400">Rotation</label>
            <span className="text-xs text-gray-500">{rotation}°</span>
          </div>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
            className="w-full accent-parlor-500"
          />
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end pt-1">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleApply}>
            Apply
          </Button>
        </div>
      </div>
    </Modal>
  );
}
