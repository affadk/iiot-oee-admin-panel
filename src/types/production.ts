export type WorkOrderStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'ABORTED';

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
  completed_quantity: number;
  rejected_quantity: number;
  status: WorkOrderStatus;
  planned_start: string;
  start_time?: string | null;
  end_time?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
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
    targetPerHour: number;
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
    };
    status: WorkOrderStatus;
  };
}

export interface WorkOrderCancelResult {
  success: boolean;
  work_order: {
    wo_id: string;
    status: 'ABORTED';
    machine_id: string | null;
  };
}

export interface Product {
  product_id: string;
  name: string;
  ideal_cycle_time_seconds: number;
  created_at?: string;
}

export interface Operator {
  operator_id: string;
  name: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | 'MAINTENANCE';
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
