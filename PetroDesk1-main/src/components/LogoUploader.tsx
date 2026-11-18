import React, { useRef, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface LogoUploaderProps {
  brand: string;
  logoUrl: string | null;
  onChange: (dataUrl: string | null) => void;
}

export function LogoUploader({ brand, logoUrl, onChange }: LogoUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      // Resize to max 256x256 via canvas to keep payload small
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        // White background for transparency
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        // Draw centered/cropped to square
        const dim = Math.min(img.width, img.height);
        const sx = (img.width - dim) / 2;
        const sy = (img.height - dim) / 2;
        ctx.drawImage(img, sx, sy, dim, dim, 0, 0, size, size);
        onChange(canvas.toDataURL('image/png'));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
        Station Logo
      </label>

      <div className="flex items-center gap-4">
        {/* Preview */}
        <div className="w-16 h-16 rounded-xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center bg-slate-50 dark:bg-slate-950 shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt="logo" className="w-full h-full object-cover" />
          ) : (
            <BrandLogo brand={brand || 'PetroDesk'} className="w-10 h-10" />
          )}
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex-1 flex flex-col items-center justify-center gap-1.5 px-4 py-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors
            ${dragging
              ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/30'
              : 'border-slate-300 dark:border-slate-700 hover:border-teal-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
        >
          <Upload className="w-4 h-4 text-slate-400" />
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            <span className="font-medium text-teal-700 dark:text-teal-400">Click to upload</span> or drag & drop
          </p>
          <p className="text-[11px] text-slate-400">PNG, JPG, SVG — auto-resized to 256×256</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </div>

        {/* Remove button */}
        {logoUrl && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
            title="Remove logo"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {logoUrl && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
          <ImagePlus className="w-3 h-3" />
          Custom logo uploaded — will override the auto-detected brand icon.
        </p>
      )}
    </div>
  );
}
