/**
 * Feedback alur konfigurasi broker (E31.2, FAT-265) — satu alur:
 * pesan sukses/error + daftar issue validasi 422. Dipisah dari
 * `useBrokerConfig` (R4); state ini dipakai bersama oleh alur load,
 * stage, versions, dan confirm, jadi tinggal di hook kecil ini.
 */
import { useState } from 'react';
import type { BrokerFeedback, BrokerValidationIssue } from './brokerConfigTypes';

export function useBrokerConfigFeedback() {
  // Validation 422 issues & general feedback
  const [validationIssues, setValidationIssues] = useState<BrokerValidationIssue[]>([]);
  const [feedback, setFeedback] = useState<BrokerFeedback | null>(null);

  return { validationIssues, setValidationIssues, feedback, setFeedback };
}
