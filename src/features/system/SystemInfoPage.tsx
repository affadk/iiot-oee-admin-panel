import React from 'react';
import { Info, ShieldCheck, Cpu, Network, Database } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { useNetworkAccess } from '../../context/NetworkAccessContext';

export const SystemInfoPage: React.FC = () => {
  const { authMe, currentUser } = useAuth();
  const { mode } = useNetworkAccess();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Informasi Sistem &amp; Panduan Akses
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Informasi perangkat lunak manajemen produksi, perbedaan akses jaringan lokal dan jarak jauh, serta ringkasan hak akses akun Anda.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-2.5">
          <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sky-500" />
            <span>Perangkat Sensor Lantai Produksi</span>
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Gateway lapangan menggunakan pengontrol industri <strong>STM32</strong> dengan penyimpanan cadangan otomatis pada kartu memori bila jaringan terputus, serta koneksi terenkripsi ke server pabrik.
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-2.5">
          <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Network className="w-4 h-4 text-emerald-500" />
            <span>Pengaturan Jaringan Lokal vs Jarak Jauh</span>
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Akses dari <strong>Jaringan Lokal Pabrik</strong> memberikan kontrol penuh sesuai peran pengguna. Akses melalui <strong>Jaringan Jarak Jauh</strong> dibatasi hanya untuk pemantauan (mode baca-saja). Status saat ini: <Badge variant={mode === 'LAN' ? 'success' : 'warning'}>{mode === 'LAN' ? 'Jaringan Lokal' : 'Akses Jarak Jauh'}</Badge>.
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-2.5">
          <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            <span>Hak Akses Akun Aktif</span>
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Izin fitur untuk akun Anda (<strong>{currentUser.operator_id} · {currentUser.role}</strong>) disinkronkan langsung dari kebijakan keamanan sistem (Mode: <strong>{authMe?.mode === 'shadow' ? 'Simulasi' : 'Penegakan Aktif'}</strong>).
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-2.5">
          <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-500" />
            <span>Pembagian Fungsi Panel Admin vs Layar Operator</span>
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Kontrol langsung mesin di lantai produksi serta pembuatan, penugasan, dan penyelesaian Work Order dilakukan secara eksklusif melalui layar operator pabrik (HMI) dan tidak tersedia di Panel Admin.
          </p>
        </div>
      </div>

      <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-md flex items-center gap-2 text-xs text-slate-500">
        <Info className="w-4 h-4 text-sky-500 shrink-0" />
        <span>OEE Enterprise IIoT Admin Console · Sistem Pemantauan &amp; Pengelolaan Produksi Pabrik.</span>
      </div>
    </div>
  );
};
