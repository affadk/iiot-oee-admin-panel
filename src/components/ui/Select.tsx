import React from 'react';

interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  hint?: string;
  /**
   * E31.9 (FAT-269): kelas wrapper pembungkus. Default `w-full` (form).
   * Untuk select di toolbar/baris flex, isi mis. `shrink-0` supaya
   * wrapper tidak mengambil seluruh lebar baris.
   */
  wrapperClassName?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  error,
  hint,
  wrapperClassName = 'w-full',
  className = '',
  id,
  ...props
}) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`${wrapperClassName} space-y-1`}>
      {label && (
        <label htmlFor={selectId} className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border rounded transition-colors text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 disabled:opacity-60 ${
          error ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'
        } ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled} className="bg-white dark:bg-slate-900">
            {opt.label}
          </option>
        ))}
      </select>
      {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
};
