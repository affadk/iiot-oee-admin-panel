/**
 * Tipe bersama alur konfigurasi broker (E31.2, FAT-265).
 *
 * Dipindah dari `useBrokerConfig.ts` saat hook itu dipecah per alur
 * (R4: satu hook = satu alur data) — sub-hook di folder ini dan
 * `useBrokerConfig.ts` (komposisi) sama-sama mengimpor dari sini, jadi
 * tidak ada import siklik. `useBrokerConfig.ts` me-re-export tipe-tipe
 * ini supaya import lama (`BrokerConfirmModal`) tetap jalan tanpa
 * perubahan.
 */
import type {
  BrokerConfigStatus,
  BrokerConfigVersion,
  BrokerConfigDiffResult,
} from '../../../types/mqtt';

export type BrokerConfirmAction = { type: 'APPLY' | 'ROLLBACK'; version: BrokerConfigVersion };

// E23 Batch 1 (FAT-182, N-13): hasil diff = bentuk spec live
// (`BrokerConfigDiffResult`: `lines[]`), bukan `diff_summary`/`changed_keys`.
export type BrokerDiffResult = BrokerConfigDiffResult;

export type BrokerFeedback = { type: 'success' | 'error'; msg: string };

// E20 P20.5 (FAT-157): status konfigurasi = bentuk dokumen §3.3b
// (`BrokerConfigStatus`), bukan asumsi lama `active_version`/`sync_state`.
export type BrokerSyncStatus = BrokerConfigStatus;

export type BrokerValidationIssue = { field?: string; message: string };
