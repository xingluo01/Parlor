import { forwardRef, useState } from 'react';
import { User } from 'lucide-react';
import { cn } from '../../utils/cn';

interface AvatarProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeStyles = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-xl',
};

const iconSizes = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export const Avatar = forwardRef<HTMLImageElement, AvatarProps>(
  ({ src, alt = '', name, size = 'md', className, ...props }, ref) => {
    const [hasError, setHasError] = useState(false);
    const showFallback = !src || hasError;
    const initials = name ? getInitials(name) : '';

    if (showFallback) {
      return (
        <div
          className={cn(
            'rounded-full flex items-center justify-center',
            'bg-dark-50 border border-glass-border',
            'text-gray-500 font-medium',
            'ring-1 ring-dark-300/50',
            sizeStyles[size],
            className
          )}
        >
          {initials ? (
            <span className="font-serif tracking-wide">{initials}</span>
          ) : (
            <User className={iconSizes[size]} />
          )}
        </div>
      );
    }

    return (
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn(
          'rounded-full object-cover',
          'bg-dark-50 ring-1 ring-white/[0.06]',
          sizeStyles[size],
          className
        )}
        onError={() => setHasError(true)}
        {...props}
      />
    );
  }
);

Avatar.displayName = 'Avatar';
