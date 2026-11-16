import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border rounded transition-colors text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:opacity-60 ${
          error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-300 dark:border-slate-700'
        } ${className}`}
        {...props}
      />
      {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
};
