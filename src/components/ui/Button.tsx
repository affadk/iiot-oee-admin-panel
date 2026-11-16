import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const base = 'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 whitespace-nowrap shrink-0 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 min-h-[32px] gap-1.5',
    md: 'text-sm px-3.5 py-2 min-h-[40px] gap-2',
    lg: 'text-sm px-5 py-2.5 min-h-[48px] gap-2.5 font-semibold',
  };

  const variants = {
    primary: 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm focus-visible:ring-sky-500',
    secondary: 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 focus-visible:ring-slate-400',
    outline: 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 focus-visible:ring-slate-400',
    danger: 'bg-red-600 hover:bg-red-500 text-white shadow-sm focus-visible:ring-red-500',
    ghost: 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50',
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin h-4 w-4 mr-1 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  );
};
