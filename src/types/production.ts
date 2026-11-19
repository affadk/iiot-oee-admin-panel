export type WorkOrderStatus = 'PENDING' | 'ACTIVE' | 'PENDING_CLOSE' | 'COMPLETED' | 'ABORTED';

export interface WorkOrder {
  wo_id: string;
  order_number: string;
  product_id: string | null;
  product_name: string | null;
  machine_id: string | null;
  machine_name: string | null;
  operator_id: string | null;
  operator_name: string | null;
  shift_name: string;
  target_quantity: number;
  target_qty?: number;
  // E20 P20.5 (FAT-157): `completed_quantity`/`rejected_quantity` DIHAPUS —
  // field karangan, tidak ada di item §C. Progres WO dibaca dari live-state
  // / telemetri, bukan dari baris WO.
  status: WorkOrderStatus;
  /** Null bila server tidak mengirimnya — jangan fallback ke start_time/created_at. */
  planned_start: string | null;
  start_time?: string | null;
  end_time?: string | null;
  /** E20 P20.5 (FAT-157): nama kanonis §C — `actual_start_at`/`actual_end_at`. */
  actual_start_at?: string | null;
  actual_end_at?: string | null;
  /** E20 P20.5 (FAT-157): field workflow §C.1 (nullable bila belum terjadi). */
  dispatched_at?: string | null;
  acked_at?: string | null;
  provisional?: boolean;
  count_uncertain?: boolean;
  notes?: string;
  cancel_reason?: string;
}

export interface WorkOrderResolveResult {
  success: boolean;
  work_order: {
    wo_id: string;
    machine_id: string | null;
    product_id: string | null;
    product_name: string | null;
    std_cycle_time_sec: number;
    operator_id: string | null;
    operator_name: string | null;
    target_qty: number;
    // E23 Batch 4 (FAT-204, N-35): spec live — `targetPerHour` opsional +
    // nullable (0 vs 'tidak diketahui' dibedakan) dan `break` opsional.
    // Absen/null → null, BUKAN 0 / break fabrikasi {start:'', end:'', minutes:0}.
    targetPerHour: number | null;
    shift_plan: {
      shift_start: string;
      shift_end: string;
      planned_break_min: number;
      planned_operating_sec: number;
    };
    break: {
      start: string;
      end: string;
      minutes: number;
    } | null;
    status: WorkOrderStatus;
  };
}

export interface WorkOrderCancelResult {
  success: boolean;
  work_order: {
    wo_id: string;
    // E23 Batch 4 (FAT-204, N-35): status dibaca dari respons cancel
    // (spec: string); 'ABORTED' hanya fallback bila respons tak membawanya.
    status: WorkOrderStatus;
    machine_id: string | null;
  };
}

export interface Product {
  product_id: string;
  sku: string;
  name: string;
  ideal_cycle_time_seconds: number;
  active: boolean;
  created_at?: string;
}

export interface Operator {
  operator_id: string;
  name: string;
  /**
   * Role adalah string bebas (API doc §H, E20 P20.3): bukan enum — default
   * `UNASSIGNED`, daftar otoritatif di `GET /access-control/roles`.
   */
  role: string;
  line_id: string;
  is_active: boolean;
  is_protected?: boolean;
  created_at: string;
}

export interface ProductionLine {
  lineId: string;
  lineName: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Shift {
  shiftId: string;
  shiftName: string;
  shiftCode: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: string;
}

export interface ShiftSchedule {
  scheduleId: string;
  lineId: string;
  shiftId: string;
  dayOfWeek: number; // 1=Senin .. 7=Minggu
  isActive: boolean;
  shiftName?: string;
  shiftCode?: string;
  startTime?: string;
  endTime?: string;
  createdAt: string;
}
