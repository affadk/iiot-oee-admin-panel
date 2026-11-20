/**
 * Filter histori — korelasi work-order + format tampilan.
 *
 * Dipisah dari features/shared/historyFilters.ts pada refactoring E31.16
 * (FAT-279, audit P3-3): satu concern per file. Barrel penggabung:
 * features/shared/historyFilters.ts.
 */
import { DowntimeEvent, OperationalEvent } from '../../../types/monitoring';
import { HourlyOeePoint, TelemetryHistoryRecord } from '../../../types/analytics';
import { Machine } from '../../../types/assets';
import { WorkOrder } from '../../../types/production';
import { formatDeletedRelationLabel, parseServerMetric } from '../../../utils/oeeCalculations';
import { formatIsoWithOffset } from '../../../utils/historicalExport';

/**
 * Resolves the production window [from, to] for a Work Order with explicit ISO offsets.
 */
export function resolveWorkOrderWindow(
  wo: WorkOrder,
  now: Date = new Date()
): { from: string; to: string } {
  // E20 P20.5 (FAT-157): nama kanonis `actual_start_at`/`actual_end_at`
  // (§C); `planned_start` null bila tak ada (tanpa fallback ke created_at).
  const rawStart = wo.actual_start_at ?? wo.start_time ?? wo.planned_start;
  const rawEnd = wo.actual_end_at ?? wo.end_time;
  // `rawStart` null (tanpa actual/planned) → fallback jendela 8 jam
  // terakhir; `new Date(null)` = epoch 1970, jadi dicek eksplisit.
  const startDate = rawStart ? new Date(rawStart) : new Date(Number.NaN);
  const endDate = rawEnd ? new Date(rawEnd) : now;

  const validStart = Number.isNaN(startDate.getTime())
    ? new Date(now.getTime() - 8 * 60 * 60 * 1000)
    : startDate;
  const validEnd =
    Number.isNaN(endDate.getTime()) || endDate.getTime() < validStart.getTime()
      ? new Date(validStart.getTime() + 60 * 60 * 1000)
      : endDate;

  return {
    from: formatIsoWithOffset(validStart),
    to: formatIsoWithOffset(validEnd),
  };
}

/**
 * Correlates work_orders.machine_id -> machines.bound_device_id (device_id)
 */
export function resolveWorkOrderDeviceId(wo: WorkOrder, machines: Machine[]): string | null {
  if (!wo.machine_id) return null;
  const machine = machines.find((m) => m.machine_id === wo.machine_id);
  return machine?.bound_device_id ?? machine?.boundDevice?.device_id ?? null;
}

/**
 * E28 Batch B (FAT-224, E2E-10): sub-baris "WO / Batch" — order_number
 * yang SAMA dengan wo_id (duplikat) dan shift_name kosong tidak dirender;
 * pemisah "·" hanya di antara bagian yang ada; bila keduanya kosong,
 * '—' (bukan "·" menggantung atau sel kosong).
 */
export function formatWorkOrderSubline(wo: Pick<WorkOrder, 'wo_id' | 'order_number' | 'shift_name'>): string {
  const parts = [
    wo.order_number && wo.order_number !== wo.wo_id ? wo.order_number : null,
    wo.shift_name || null,
  ].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export interface CorrelatedWorkOrderSummary {
  woId: string;
  machineLabel: string;
  machineDeleted: boolean;
  productLabel: string;
  productDeleted: boolean;
  operatorLabel: string;
  operatorDeleted: boolean;
  resolvedDeviceId: string | null;
  window: { from: string; to: string };
  telemetrySampleCount: number;
  provisionalHourlyCount: number;
  downtimeCount: number;
  totalDowntimeSec: number;
  operationalEventCount: number;
  avgOeePct: number | null;
  totalGoodParts: number;
  totalRejectParts: number;
}

export function correlateWorkOrderData(params: {
  workOrder: WorkOrder;
  machines: Machine[];
  telemetryRecords: TelemetryHistoryRecord[];
  hourlyPoints?: HourlyOeePoint[];
  downtimeEvents: DowntimeEvent[];
  operationalEvents: OperationalEvent[];
  now?: Date;
}): CorrelatedWorkOrderSummary {
  const {
    workOrder,
    machines,
    telemetryRecords,
    hourlyPoints = [],
    downtimeEvents,
    operationalEvents,
    now = new Date(),
  } = params;

  const machineInfo = formatDeletedRelationLabel(workOrder.machine_name, workOrder.machine_id);
  const productInfo = formatDeletedRelationLabel(workOrder.product_name, workOrder.product_id);
  const operatorInfo = formatDeletedRelationLabel(workOrder.operator_name, workOrder.operator_id);
  const resolvedDeviceId = resolveWorkOrderDeviceId(workOrder, machines);
  const window = resolveWorkOrderWindow(workOrder, now);

  const fromMs = Date.parse(window.from);
  const toMs = Date.parse(window.to);

  const inWindowTelemetry = telemetryRecords.filter((rec) => {
    const ts = Date.parse(rec.timestamp);
    return Number.isFinite(ts) && ts >= fromMs && ts <= toMs;
  });

  const inWindowDowntime = downtimeEvents.filter((ev) => {
    const startMs = Date.parse(ev.started_at);
    return Number.isFinite(startMs) && startMs >= fromMs && startMs <= toMs;
  });

  const inWindowEvents = operationalEvents.filter((ev) => {
    const ts = Date.parse(ev.recorded_at);
    return Number.isFinite(ts) && ts >= fromMs && ts <= toMs;
  });

  const provisionalHourlyCount = hourlyPoints.filter((pt) => pt.provisional).length;
  const totalDowntimeSec = inWindowDowntime.reduce((acc, ev) => acc + (ev.duration_seconds || 0), 0);

  const avgOeePct =
    inWindowTelemetry.length > 0
      ? Number(
          (
            inWindowTelemetry.reduce((acc, rec) => acc + parseServerMetric(rec.oee, 0), 0) /
            inWindowTelemetry.length
          ).toFixed(2)
        )
      : null;

  // E20 P20.5 (FAT-157): `completed_quantity`/`rejected_quantity` DIHAPUS
  // dari kontrak WO (§C) — tanpa telemetri dalam jendela, total = 0
  // (bukan angka karangan dari WO).
  const totalGoodParts =
    inWindowTelemetry.length > 0
      ? inWindowTelemetry.reduce((acc, rec) => acc + (rec.goodCount ?? rec.good_count ?? 0), 0)
      : 0;

  const totalRejectParts =
    inWindowTelemetry.length > 0
      ? inWindowTelemetry.reduce((acc, rec) => acc + (rec.rejectCount ?? rec.reject_count ?? 0), 0)
      : 0;

  return {
    woId: workOrder.wo_id,
    machineLabel: machineInfo.label,
    machineDeleted: machineInfo.isDeleted,
    productLabel: productInfo.label,
    productDeleted: productInfo.isDeleted,
    operatorLabel: operatorInfo.label,
    operatorDeleted: operatorInfo.isDeleted,
    resolvedDeviceId,
    window,
    telemetrySampleCount: inWindowTelemetry.length,
    provisionalHourlyCount,
    downtimeCount: inWindowDowntime.length,
    totalDowntimeSec,
    operationalEventCount: inWindowEvents.length,
    avgOeePct,
    totalGoodParts,
    totalRejectParts,
  };
}

export function formatRollupPerformance(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '— (Kapasitas 0/Unknown)';
  }
  const num = parseServerMetric(value, NaN);
  return Number.isFinite(num) ? `${num.toFixed(2)}%` : '—';
}
