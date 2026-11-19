import { FileCode2 } from 'lucide-react';
import type { BrokerConfigRawResult } from '../../../types/mqtt';

interface BrokerRawTabProps {
  rawConf: BrokerConfigRawResult | null;
}

export const BrokerRawTab: React.FC<BrokerRawTabProps> = ({ rawConf }) => {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-md p-4 space-y-2">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <FileCode2 className="w-4 h-4 text-sky-400" />
        <span>Tampilan berkas konfigurasi broker aktif (hanya baca)</span>
      </div>
      {/* E23 Batch 3 (FAT-199, N-30): metadata dari `GET /raw` spec
          live — tampilkan bila server mengirimnya. */}
      {rawConf?.metadata && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 font-tabular">
          <span>Sumber: {rawConf.metadata.source}</span>
          <span>Checksum: {rawConf.metadata.checksum}</span>
          <span>Ukuran: {rawConf.metadata.sizeBytes} byte</span>
          <span>Mosquitto: {rawConf.metadata.mosquittoVersion}</span>
          <span>Diubah: {rawConf.metadata.modifiedAt}</span>
        </div>
      )}
      <pre className="text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap">
        {rawConf?.text || 'Tidak tersedia'}
      </pre>
    </div>
  );
};
