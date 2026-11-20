import React from 'react';
import { TelemetryTab } from '../hooks/useTelemetryQueries';
import { TelemetryRawTabPanel, TelemetryRawTabPanelProps } from './TelemetryRawTabPanel';
import { TelemetryHourlyTabPanel, TelemetryHourlyTabPanelProps } from './TelemetryHourlyTabPanel';
import { TelemetryAggregateTabPanel, TelemetryAggregateTabPanelProps } from './TelemetryAggregateTabPanel';
import { TelemetryRollupTabPanel, TelemetryRollupTabPanelProps } from './TelemetryRollupTabPanel';

/**
 * E31 (FAT-267): gabungan keempat panel tab (raw + hourly + aggregate +
 * rollup) — bentuk props TIDAK berubah, supaya `TelemetryHistoryPage`
 * dan `TelemetryTabPanels.test.ts` tidak perlu diubah. Panel-panelnya
 * tinggal di file masing-masing (satu panel = satu concern, aturan R8);
 * komponen ini hanya memilih panel aktif dan meneruskan props.
 */
export type TelemetryTabPanelsProps = { activeTab: TelemetryTab } & TelemetryRawTabPanelProps &
  TelemetryHourlyTabPanelProps &
  TelemetryAggregateTabPanelProps &
  TelemetryRollupTabPanelProps;

export const TelemetryTabPanels: React.FC<TelemetryTabPanelsProps> = (props) => {
  const { activeTab } = props;
  return (
    <>
      {activeTab === 'raw' && <TelemetryRawTabPanel {...props} />}
      {activeTab === 'hourly' && <TelemetryHourlyTabPanel {...props} />}
      {activeTab === 'aggregate' && <TelemetryAggregateTabPanel {...props} />}
      {activeTab === 'rollup' && <TelemetryRollupTabPanel {...props} />}
    </>
  );
};
