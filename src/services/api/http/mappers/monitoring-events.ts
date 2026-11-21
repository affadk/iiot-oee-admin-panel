/**
 * Mapper backend→lokal — operational event + audit trail.
 *
 * Dipisah dari mappers/monitoring.ts pada refactoring E31.15 (FAT-278, R10:
 * satu file mapper = satu domain). Barrel penggabung: mappers/monitoring.ts.
 */
import { AuditLogItem } from '../../../../types/system';
import { OperationalEvent } from '../../../../types/monitoring';
import { str, pick } from '../primitives';

/**
 * E20 P20.4 (FAT-156): `OperationalEventItem` FR-034-01 persis (API doc §I).
 * - `acknowledged` DITURUNKAN dari `acknowledgedAt` (bukan dibaca dari field).
 * - `machineName` null bila mesin dihapus (jangan default 'Plant System').
 * - Baca `description` + `recordedAt`; `snapshotTotalCount`/`snapshotRunSec`
 *   dibuang bila tak ada (null) — jangan dikarang. Tidak ada `severity`.
 * - `event_type` diteruskan apa adanya (enum tertutup + pola); bila absen
 *   kosong — jangan default ke nilai tebakan ('STATE_CHANGE' dihapus).
 * - `recorded_at`/`created_at` kosong ('') bila tak ada — jangan isi epoch
 *   (primitif `iso()` mengarang 1970-01-01).
 * - E27 (FAT-233, T2): `station_label` dibaca TOLERAN (camelCase/snake_case)
 *   — event lama tanpa field ini → null, tidak throw. Nilai mentah dari
 *   klien (UNTRUSTED): tampilkan apa adanya, jangan jadikan key/lookup.
 */
export function mapOperationalEvent(raw: unknown): OperationalEvent {
  const r = (raw ?? {}) as Record<string, unknown>;
  const deviceId = pick(r.deviceId, r.device_id);
  const machineId = pick(r.machineId, r.machine_id);
  const machineName = pick(r.machineName, r.machine_name);
  const recordedAt = pick(r.recordedAt, r.recorded_at);
  const createdAt = pick(r.createdAt, r.created_at);
  const acknowledgedAt = pick(r.acknowledgedAt, r.acknowledged_at);
  const strOrEmpty = (v: unknown): string => (typeof v === 'string' ? v : '');
  const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
  const numOrNull = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  return {
    id: String(pick(r.id) ?? ''),
    recorded_at: strOrEmpty(recordedAt),
    device_id: deviceId === '[deleted]' ? null : (deviceId as string | null) ?? null,
    station_label: strOrNull(pick(r.stationLabel, r.station_label)),
    machine_id: machineId === '[deleted]' ? null : (machineId as string | null) ?? null,
    machine_name: machineName === '[deleted]' ? null : (machineName as string | null) ?? null,
    wo_id: (pick(r.woId, r.wo_id) as string | null) ?? null,
    event_type: (pick(r.eventType, r.event_type) as OperationalEvent['event_type']) ?? ('' as OperationalEvent['event_type']),
    trigger_source: strOrNull(pick(r.triggerSource, r.trigger_source)),
    event_code: numOrNull(pick(r.eventCode, r.event_code)),
    snapshot_total_count: numOrNull(pick(r.snapshotTotalCount, r.snapshot_total_count)),
    snapshot_run_sec: numOrNull(pick(r.snapshotRunSec, r.snapshot_run_sec)),
    description: str(pick(r.description), ''),
    acknowledged: acknowledgedAt !== undefined && acknowledgedAt !== null,
    acknowledged_at: strOrNull(acknowledgedAt),
    acknowledged_by: strOrNull(pick(r.acknowledgedBy, r.acknowledged_by)),
    ack_note: strOrNull(pick(r.ackNote, r.ack_note, r.note)),
    created_at: strOrEmpty(createdAt ?? recordedAt),
  };
}

/**
 * E20 P20.4 (FAT-156): `/system/audit` adalah alias audit trail global yang
 * mengembalikan `OperationalEventItem[]` (API doc §I) — tidak ada field
 * karangan (`operator_id`/`operator_name`, `action`, `resource_type`,
 * `resource_id`, `client_ip`, `access_mode`). Mapper audit = mapper
 * operational-event, tanpa tambahan apa pun.
 */
export function mapAuditLog(raw: unknown): AuditLogItem {
  return mapOperationalEvent(raw);
}
