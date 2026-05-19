import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { playClickSound } from '../../utils/sound';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  to?: string;          // 导航链接模式
  title?: string;
  type?: 'button' | 'submit';
}

const variantClasses: Record<string, string> = {
  primary: 'bg-parlor-600 hover:bg-parlor-500 text-white shadow-lg shadow-parlor-600/20',
  secondary: 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300',
  ghost: 'bg-transparent hover:bg-glass-white text-gray-500 hover:text-white',
  danger: 'bg-red-600 hover:bg-red-500 text-white',
};

const sizeClasses: Record<string, string> = {
  sm: 'px-2.5 py-1.5 text-xs rounded-lg',
  md: 'px-3 py-2 text-sm rounded-xl',
  lg: 'px-4 py-2.5 text-base rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  isLoading,
  disabled,
  leftIcon,
  rightIcon,
  className = '',
  children,
  onClick,
  to,
  title,
  type = 'button',
}, ref) => {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 active:scale-95 select-none disabled:opacity-50 disabled:pointer-events-none focus:outline-none';
  const allClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  const handleClick = (e: React.MouseEvent) => {
    if (!disabled && !isLoading) playClickSound();
    onClick?.(e);
  };

  const content = (
    <>
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : leftIcon}
      {children && <span>{children}</span>}
      {rightIcon}
    </>
  );

  // 导航链接模式
  if (to) {
    return (
      <Link to={to} className={allClasses} onClick={handleClick} title={title}>
        {content}
      </Link>
    );
  }

  // 普通按钮模式
  return (
    <button
      ref={ref}
      type={type}
      className={allClasses}
      onClick={handleClick}
      disabled={disabled || isLoading}
      title={title}
    >
      {content}
    </button>
  );
});

Button.displayName = 'Button';
