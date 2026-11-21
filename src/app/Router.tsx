import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { LoginPage } from '../features/auth/LoginPage';
import { ForceChangePasswordPage } from '../features/auth/ForceChangePasswordPage';
import { OverviewPage } from '../features/overview/OverviewPage';
import { WorkOrdersPage } from '../features/production/WorkOrdersPage';
import { ProductsPage } from '../features/production/ProductsPage';
import { OperatorsPage } from '../features/production/OperatorsPage';
import { ProductionLinesPage } from '../features/production/ProductionLinesPage';
import { ShiftsPage } from '../features/production/ShiftsPage';
import { ShiftSchedulesPage } from '../features/production/ShiftSchedulesPage';
import { MachinesPage } from '../features/assets/MachinesPage';
import { DevicesPage } from '../features/assets/DevicesPage';
import { StationsPage } from '../features/assets/StationsPage';
import { LiveStatePage } from '../features/monitoring/LiveStatePage';
import { DowntimeEventsPage } from '../features/monitoring/DowntimeEventsPage';
import { OperationalEventsPage } from '../features/monitoring/OperationalEventsPage';
import { OeeAnalyticsPage } from '../features/analytics/OeeAnalyticsPage';
import { QualityRejectsPage } from '../features/analytics/QualityRejectsPage';
import { TelemetryHistoryPage } from '../features/analytics/TelemetryHistoryPage';
import { DataReconciliationPage } from '../features/analytics/DataReconciliationPage';
import { BrokerOverviewPage } from '../features/mqtt/BrokerOverviewPage';
import { DynamicSecurityPage } from '../features/mqtt/DynamicSecurityPage';
import { BrokerConfigManagerPage } from '../features/mqtt/BrokerConfigManagerPage';
import { SystemHealthPage } from '../features/system/SystemHealthPage';
import { AuditTrailPage } from '../features/system/AuditTrailPage';
import { SystemInfoPage } from '../features/system/SystemInfoPage';
import { AccessControlPage } from '../features/system/AccessControlPage';
import { IamAuditPage } from '../features/system/IamAuditPage';

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        
        {/* Auth Route (Spec §8.1) */}
        <Route path="/login" element={<LoginPage />} />

        {/* Gerbang ganti-password-wajib — spec 043 (§L): di luar AdminLayout,
            tanpa jalur kedua selama gerbang aktif. */}
        <Route path="/force-change-password" element={<ForceChangePasswordPage />} />

        {/* Canonical Historical & Operations Top-Level Routes (§1) */}
        <Route element={<AdminLayout />}>
          <Route path="/work-orders" element={<WorkOrdersPage />} />
          <Route path="/telemetry" element={<TelemetryHistoryPage />} />
          <Route path="/analytics" element={<OeeAnalyticsPage />} />
          <Route path="/downtime" element={<DowntimeEventsPage />} />
          {/* P33.7 (FAT-302): rute lama dialihkan ke kanonik /admin/alarms
              dan /admin/system-audit — satu rute kanonik per halaman. */}
          <Route path="/audit" element={<Navigate to="/admin/alarms" replace />} />
          <Route path="/system-audit" element={<Navigate to="/admin/system-audit" replace />} />
        </Route>

        {/* Admin Console (Spec §3.1) */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<OverviewPage />} />

          {/* Canonical Spec §3.1 Routes */}
          <Route path="work-orders" element={<WorkOrdersPage />} />
          <Route path="downtime" element={<DowntimeEventsPage />} />
          {/* P33.7 (FAT-302): /admin/alarms adalah rute kanonik Alarm &
              Event; /admin/audit lama dialihkan ke sana. */}
          <Route path="alarms" element={<OperationalEventsPage />} />
          <Route path="audit" element={<Navigate to="/admin/alarms" replace />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="stations" element={<StationsPage />} />
          <Route path="machines" element={<MachinesPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="operators" element={<OperatorsPage />} />
          <Route path="lines" element={<ProductionLinesPage />} />
          <Route path="shifts" element={<ShiftsPage />} />
          <Route path="shift-schedules" element={<ShiftSchedulesPage />} />
          <Route path="telemetry" element={<TelemetryHistoryPage />} />
          <Route path="analytics" element={<OeeAnalyticsPage />} />
          <Route path="shift-analytics" element={<OeeAnalyticsPage />} />
          <Route path="quality" element={<QualityRejectsPage />} />
          <Route path="reconciliation" element={<DataReconciliationPage />} />
          <Route path="access-control" element={<AccessControlPage />} />
          <Route path="live-state" element={<LiveStatePage />} />

          {/* MQTT & Connectivity */}
          <Route path="mqtt" element={<BrokerOverviewPage />} />
          <Route path="mqtt/overview" element={<BrokerOverviewPage />} />
          <Route path="mqtt/security" element={<DynamicSecurityPage />} />
          <Route path="mqtt/configuration" element={<BrokerConfigManagerPage />} />
          <Route path="mqtt/configuration/*" element={<BrokerConfigManagerPage />} />

          {/* System */}
          <Route path="system-audit" element={<AuditTrailPage />} />
          <Route path="iam-audit" element={<IamAuditPage />} />
          <Route path="system/health" element={<SystemHealthPage />} />
          <Route path="system/audit" element={<Navigate to="/admin/system-audit" replace />} />
          <Route path="system/info" element={<SystemInfoPage />} />
          <Route path="system/access-control" element={<AccessControlPage />} />

          {/* Backwards-compatible aliases */}
          <Route path="production/work-orders" element={<WorkOrdersPage />} />
          <Route path="production/products" element={<ProductsPage />} />
          <Route path="production/operators" element={<OperatorsPage />} />
          <Route path="assets/machines" element={<MachinesPage />} />
          <Route path="assets/devices" element={<DevicesPage />} />
          <Route path="assets/stations" element={<StationsPage />} />
          <Route path="monitoring/live-state" element={<LiveStatePage />} />
          <Route path="monitoring/downtime" element={<DowntimeEventsPage />} />
          <Route path="monitoring/events" element={<Navigate to="/admin/alarms" replace />} />
          <Route path="analytics/oee" element={<OeeAnalyticsPage />} />
          <Route path="analytics/quality" element={<QualityRejectsPage />} />
          <Route path="analytics/telemetry" element={<TelemetryHistoryPage />} />
          <Route path="analytics/reconciliation" element={<DataReconciliationPage />} />
          <Route path="mqtt/config" element={<BrokerConfigManagerPage />} />
          <Route path="events" element={<Navigate to="/admin/alarms" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
