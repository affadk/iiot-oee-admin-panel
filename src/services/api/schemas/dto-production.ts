/**
 * Skema Zod DTO — domain production (WO, lini, shift) (validasi respons backend).
 *
 * Dipisah dari schemas/dto.ts pada refactoring E31.15 (FAT-278, R10:
 * satu file skema = satu domain). Barrel penggabung: schemas/dto.ts.
 */
import { NumericCoercionSchema } from './transport';
import { z } from 'zod';

export const WorkOrderResolveSchema = z.object({
  success: z.boolean(),
  work_order: z.object({
    wo_id: z.string(),
    machine_id: z.string().nullable(),
    product_id: z.string().nullable(),
    product_name: z.string().nullable(),
    std_cycle_time_sec: NumericCoercionSchema,
    operator_id: z.string().nullable(),
    operator_name: z.string().nullable(),
    target_qty: z.number(),
    // E23 Batch 4 (FAT-204, N-35): spec live — `targetPerHour` opsional +
    // nullable, `break` opsional (absen → null, bukan fabrikasi).
    targetPerHour: z.number().nullable().optional(),
    shift_plan: z.object({
      shift_start: z.string(),
      shift_end: z.string(),
      planned_break_min: z.number(),
      planned_operating_sec: z.number(),
    }),
    break: z
      .object({
        start: z.string(),
        end: z.string(),
        minutes: z.number(),
      })
      .nullable()
      .optional(),
    status: z.enum(['PENDING', 'ACTIVE', 'COMPLETED', 'ABORTED']),
  }),
});

export const ProductionLineSchema = z.object({
  lineId: z.string().regex(/^[A-Z0-9_-]{1,64}$/),
  lineName: z.string().min(3).max(100),
  description: z.string().max(255).nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export const ShiftSchema = z.object({
  shiftId: z.string().regex(/^[A-Z0-9_-]{1,64}$/),
  shiftName: z.string().min(2).max(100),
  shiftCode: z.string().min(1).max(32),
  // E23 Batch 2 (FAT-185, N-16): spec live `startTime`/`endTime` hanya
  // string TANPA format — server boleh mengirim `07:00:00`. Skema TIDAK
  // lagi menuntut HH:MM ketat (dulu regex di sini membuat SELURUH list
  // melempar INVALID_RESPONSE bila satu item berformat `HH:MM:SS`);
  // normalisasi ke HH:MM dilakukan mapper (`normalizeShiftTime`,
  // mappers/assets.ts). Nilai yang tak bisa diparse diteruskan apa adanya
  // (tampil mentah, bukan gagal total).
  startTime: z.string(),
  endTime: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export const ShiftScheduleSchema = z.object({
  scheduleId: z.string().min(1),
  lineId: z.string().min(1),
  shiftId: z.string().min(1),
  // E23 Batch 2 (FAT-186, N-17): spec live `dayOfWeek` hanya number TANPA
  // rentang/konvensi — server boleh memakai 0..6 (0=Minggu). Terima 0..7;
  // mapper menormalisasi 0 → 7 agar konsisten dengan konvensi panel
  // 1=Senin..7=Minggu (label hari di ShiftSchedulesPage).
  dayOfWeek: z.number().int().min(0).max(7),
  isActive: z.boolean(),
  shiftName: z.string().optional(),
  shiftCode: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  createdAt: z.string(),
});
