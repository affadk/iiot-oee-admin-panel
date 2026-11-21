import { DowntimeCategory } from '../../types/monitoring';
import { DowntimeSixBigLossMap, SixBigLossInfo } from '../../types/historical';

const SIX_BIG_LOSSES_MAP: DowntimeSixBigLossMap = {
  EQUIPMENT_FAILURE: {
    group: 'BREAKDOWNS',
    label: '1. Equipment Failures / Breakdowns',
    oee_pillar: 'AVAILABILITY',
  },
  SETUP_AND_ADJUSTMENT: {
    group: 'SETUP_AND_ADJUSTMENTS',
    label: '2. Setup & Adjustments',
    oee_pillar: 'AVAILABILITY',
  },
  IDLING_AND_MINOR_STOPPAGE: {
    group: 'SMALL_STOPS',
    label: '3. Idling & Minor Stops',
    oee_pillar: 'PERFORMANCE',
  },
  REDUCED_SPEED: {
    group: 'REDUCED_SPEED',
    label: '4. Reduced Speed',
    oee_pillar: 'PERFORMANCE',
  },
  PROCESS_DEFECT: {
    group: 'PROCESS_DEFECTS',
    label: '5. Process Defects & Rework',
    oee_pillar: 'QUALITY',
  },
  MATERIAL_SHORTAGE: {
    group: 'STARTUP_AND_PLANNED_LOSSES',
    label: '6. Startup / Material & Operational Losses',
    oee_pillar: 'AVAILABILITY',
  },
  PLANNED_MAINTENANCE: {
    group: 'STARTUP_AND_PLANNED_LOSSES',
    label: '6. Planned Maintenance Stop',
    oee_pillar: 'PLANNED_EXCLUSION',
  },
  REST_BREAK: {
    group: 'STARTUP_AND_PLANNED_LOSSES',
    label: '6. Scheduled Rest Break',
    oee_pillar: 'PLANNED_EXCLUSION',
  },
  CLEANING_5S: {
    group: 'STARTUP_AND_PLANNED_LOSSES',
    label: '6. Scheduled Cleaning / 5S',
    oee_pillar: 'PLANNED_EXCLUSION',
  },
  OTHER: {
    group: 'STARTUP_AND_PLANNED_LOSSES',
    label: '6. Startup / Other Losses',
    oee_pillar: 'AVAILABILITY',
  },
  // E23 Batch 3 (FAT-194, N-25): 'UNKNOWN' = server tidak mengirim
  // kategori — bukan kerugian yang terklasifikasi; label jujur, bukan
  // pengelompokan ke salah satu dari Six Big Losses.
  UNKNOWN: {
    group: 'STARTUP_AND_PLANNED_LOSSES',
    label: 'Belum dikategorikan',
    oee_pillar: 'AVAILABILITY',
  },
};

export function mapDowntimeToSixBigLoss(category: DowntimeCategory): SixBigLossInfo {
  return SIX_BIG_LOSSES_MAP[category] ?? SIX_BIG_LOSSES_MAP.OTHER;
}
