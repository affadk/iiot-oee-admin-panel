export const RETENTION_POLICY_DAYS = 90;
export const DEFAULT_HISTORY_PAGE_LIMIT = 50;
// E12 T12.18 (U-4 / FAT-65): timeout ekspor klien disamakan dengan Guide
// §4.2 (60–120 dtk; `VITE_EXPORT_TIMEOUT_MS` default 120.000 ms di
// `services/api/mode.ts`, dipakai transport HTTP). Nilai lama 90.000 ms
// membuat abort klien memotong ekspor yang transport-nya masih
// mengizinkan sampai 120 dtk.
export const EXPORT_TIMEOUT_MS = 120_000;
