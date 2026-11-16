import React from 'react';
import { RejectParetoItem } from '../../../types/analytics';
import { useCapability } from '../../../context/AuthContext';

interface QualityRejectParetoProps {
  paretoItems: RejectParetoItem[];
  paretoScope: 'GLOBAL' | 'DEVICE';
  onScopeChange: (scope: 'GLOBAL' | 'DEVICE') => void;
  resolvedDeviceId: string;
  canReadQuality: ReturnType<typeof useCapability>;
}

export const QualityRejectPareto: React.FC<QualityRejectParetoProps> = ({
  paretoItems,
  paretoScope,
  onScopeChange,
  resolvedDeviceId,
  canReadQuality,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Quality Reject Pareto ({paretoScope === 'GLOBAL' ? 'Plant-Wide' : resolvedDeviceId})
          </h2>
          <p className="text-[11px] text-slate-500">
            Distribusi cacat produksi terbanyak beserta persentase kumulatif (80/20).
          </p>
        </div>
        {canReadQuality.canInteract && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onScopeChange('GLOBAL')}
              className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                paretoScope === 'GLOBAL'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              Plant-Wide
            </button>
            <button
              type="button"
              onClick={() => onScopeChange('DEVICE')}
              className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                paretoScope === 'DEVICE'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              Device ({resolvedDeviceId})
            </button>
          </div>
        )}
      </div>

      {!canReadQuality.canInteract ? (
        <div className="p-4 text-xs text-slate-500">
          {canReadQuality.reason || 'Anda tidak memiliki capability quality.read untuk melihat Pareto Reject.'}
        </div>
      ) : (
        <div className="p-4 space-y-2.5">
          {paretoItems.map((item) => (
            <div key={item.reason} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-800 dark:text-slate-200">{item.reason}</span>
                <span className="font-tabular text-slate-600 dark:text-slate-400">
                  {item.count} pcs ({item.percentage.toFixed(1)}% · Kumulatif {item.cumulative_percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(2, item.percentage))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
