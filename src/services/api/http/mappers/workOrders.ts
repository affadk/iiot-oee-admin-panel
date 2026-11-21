/**
 * Mapper backend→lokal — domain workOrders (FAT-285, E32.4, R10).
 *
 * Dipindah verbatim dari `transport.ts` (575/600, ambang batas keras):
 * mapper tinggal di `mappers/`, satu file = satu domain. Impor lama
 * (`./transport`) tetap jalan lewat re-export di barrel transport.
 */
import { num, str, bool, pick } from '../primitives';
import { WorkOrder } from '../../../../types/production';

export function mapWorkOrder(raw: unknown): WorkOrder {
  const r = (raw ?? {}) as Record<string, unknown>;
  const woId = str(pick(r.wo_id, r.woId));
  return {
    wo_id: woId,
    order_number: str(pick(r.order_number, r.orderNumber, woId)),
    product_id: (pick(r.product_id, r.productId) as string | null) ?? null,
    product_name: (pick(r.product_name, r.productName) as string | null) ?? null,
    machine_id: (pick(r.machine_id, r.machineId) as string | null) ?? null,
    machine_name: (pick(r.machine_name, r.machineName) as string | null) ?? null,
    operator_id: (pick(r.operator_id, r.operatorId) as string | null) ?? null,
    operator_name: (pick(r.operator_name, r.operatorName) as string | null) ?? null,
    shift_name: str(pick(r.shift_name, r.shiftName, r.shift_code, r.shiftCode), ''),
    target_quantity: num(pick(r.target_qty, r.targetQty, r.target_quantity), 0),
    target_qty: num(pick(r.target_qty, r.targetQty), 0),
    status: (pick(r.status) as WorkOrder['status']) ?? 'PENDING',
    // E20 P20.5 (FAT-157): `planned_start` null bila tak ada — JANGAN
    // fallback ke `start_time` lalu `created_at`.
    planned_start: (pick(r.planned_start, r.plannedStart) as string | null) ?? null,
    start_time: (pick(r.start_time, r.startTime) as string | null) ?? null,
    end_time: (pick(r.end_time, r.endTime) as string | null) ?? null,
    // E20 P20.5 (FAT-157): nama kanonis §C — `actual_start_at` /
    // `actual_end_at`; alias lama `actual_start`/`actual_end` tetap
    // dibaca sebagai fallback (server lama), tapi tidak ditulis kembali.
    actual_start_at: (pick(r.actual_start_at, r.actualStartAt, r.actual_start, r.actualStart) as string | null) ?? null,
    actual_end_at: (pick(r.actual_end_at, r.actualEndAt, r.actual_end, r.actualEnd) as string | null) ?? null,
    dispatched_at: (pick(r.dispatched_at, r.dispatchedAt) as string | null) ?? null,
    acked_at: (pick(r.acked_at, r.ackedAt) as string | null) ?? null,
    provisional: bool(pick(r.provisional), false),
    count_uncertain: bool(pick(r.count_uncertain, r.countUncertain), false),
    notes: str(pick(r.notes), undefined) || undefined,
    cancel_reason: str(pick(r.cancel_reason, r.reason), undefined) || undefined,
  };
}
