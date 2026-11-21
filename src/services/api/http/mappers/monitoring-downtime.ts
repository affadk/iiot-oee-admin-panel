/**
 * Mapper backend→lokal — downtime.
 *
 * Dipisah dari mappers/monitoring.ts pada refactoring E31.15 (FAT-278, R10:
 * satu file mapper = satu domain). Barrel penggabung: mappers/monitoring.ts.
 */
import { DowntimeEvent, DowntimeCategory } from '../../../../types/monitoring';
import { num, str, bool, iso, pick } from '../primitives';

export function mapDowntime(raw: unknown): DowntimeEvent {
  const r = (raw ?? {}) as Record<string, unknown>;
  const deviceId = pick(r.deviceId, r.device_id);
  const machineId = pick(r.machineId, r.machine_id);
  // E23 Batch 3 (FAT-194, N-25): spec live TIDAK punya `category` pada
  // item downtime — nilai yang dikirim server dipakai bila ada (bentuk
  // demo/legacy), bila tidak → 'UNKNOWN' (penanda lokal "tidak ada dari
  // server"), BUKAN 'OTHER' (nilai kategori POST /reason yang sah).
  // `isLabeled` spec dibaca langsung (dulu diturunkan dari ada/tidaknya
  // reason); `reason` ← `operatorReason` kanonis spec.
  const rawCategory = pick(r.category) as DowntimeCategory | undefined;
  const validCategories: DowntimeCategory[] = [
    'EQUIPMENT_FAILURE', 'SETUP_AND_ADJUSTMENT', 'IDLING_AND_MINOR_STOPPAGE',
    'REDUCED_SPEED', 'PROCESS_DEFECT', 'MATERIAL_SHORTAGE',
    'PLANNED_MAINTENANCE', 'REST_BREAK', 'CLEANING_5S', 'OTHER', 'UNKNOWN',
  ];
  const reason = str(pick(r.operatorReason, r.operator_reason, r.reason), '');
  const isLabeledRaw = pick(r.isLabeled, r.is_labeled);
  return {
    id: String(pick(r.id, r.eventId, r.event_id) ?? ''),
    device_id: deviceId === '[deleted]' ? null : (deviceId as string | null) ?? null,
    machine_id: machineId === '[deleted]' ? null : (machineId as string | null) ?? null,
    machine_name: str(pick(r.machineName, r.machine_name), ''),
    started_at: iso(pick(r.startTime, r.start_time, r.startedAt, r.started_at)),
    ended_at: (pick(r.endTime, r.end_time, r.endedAt, r.ended_at) as string | null) ?? null,
    // E20 P20.5 (FAT-157): sumber kebenaran durasi adalah `duration_sec`
    // (§7B/D1) — dibaca PERTAMA; alias lain hanya fallback.
    duration_seconds: num(pick(r.duration_sec, r.durationSec, r.duration_seconds), 0),
    durationFormatted: str(pick(r.durationFormatted, r.duration_formatted), undefined) || undefined,
    category: rawCategory !== undefined && validCategories.includes(rawCategory) ? rawCategory : 'UNKNOWN',
    reason,
    notes: str(pick(r.notes), undefined) || undefined,
    is_labeled: typeof isLabeledRaw === 'boolean' ? isLabeledRaw : Boolean(reason),
    is_overwrite: bool(pick(r.isOverwrite, r.is_overwrite), false),
    acknowledged_by: str(pick(r.acknowledgedBy, r.acknowledged_by), undefined) || undefined,
    created_at: iso(pick(r.createdAt, r.created_at, r.startTime, r.start_time)),
  };
}
