import { FileCode2 } from 'lucide-react';

interface BrokerRawTabProps {
  rawConf: string | null;
}

export const BrokerRawTab: React.FC<BrokerRawTabProps> = ({ rawConf }) => {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-md p-4 space-y-2">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <FileCode2 className="w-4 h-4 text-sky-400" />
        <span>Tampilan berkas konfigurasi broker aktif (hanya baca)</span>
      </div>
      <pre className="text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap">
        {rawConf || 'Tidak tersedia'}
      </pre>
    </div>
  );
};
