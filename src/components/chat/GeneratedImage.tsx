import { useState } from 'react';
import { X, Maximize2 } from 'lucide-react';

type GeneratedImageProps = {
  src: string;
  alt?: string;
};

export function GeneratedImage({ src, alt = 'Generated image' }: GeneratedImageProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div
        className="inline-block my-2 cursor-pointer group relative"
        onClick={() => setExpanded(true)}
      >
        <img
          src={src}
          alt={alt}
          className="rounded-lg max-w-xs max-h-64 object-cover border border-glass-border"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg flex items-center justify-center">
          <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setExpanded(false)}
        >
          <button
            onClick={() => setExpanded(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-dark-100/80 text-white hover:bg-dark-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
