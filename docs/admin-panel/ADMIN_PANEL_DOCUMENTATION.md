# Dokumentasi Kontrak Admin Panel — IIoT OEE (Terkoreksi — Spec 025)

**Status:** AUTHORITATIVE CONTRACT ALIGNMENT (`025-admin-panel-contract-alignment`)  
**Scope:** Admin Panel Frontend (`/login`, `/admin/*`) & Kontrak Integrasi Backend (`API v1`)  
**Catatan Referensi:** Dokumen desain awal `/ADMIN_PANEL_DESIGN_SPEC.md` tetap dipertahankan utuh sebagai arsip desain historis. Dokumen ini adalah kontrak terkoreksi yang wajib diikuti oleh `apiClient`, tipe TypeScript, halaman Admin Panel, dan pengujian kontrak.

---

## 1. Ringkasan Penyelarasan Kontrak

1. **Label Runtime Backend:** Seluruh UI menggunakan label **`API v1`** (bukan versi Fastify dan tidak menampilkan field `fastify_version`).
2. **Konvensi Prefix Endpoint:** Seluruh endpoint REST Admin Panel wajib menggunakan prefix **`/api/v1/...`**, kecuali **`GET /health`** dan **`GET /ws/telemetry`**.
3. **Status Work Order Kanonik:** Nilai status Work Order hanya **`PENDING`**, **`ACTIVE`**, **`COMPLETED`**, **`ABORTED`** (menggantikan label lama `DISPATCHED`, `IN_PROGRESS`, `CANCELLED`).
4. **Penggantian Endpoint yang Tidak Tersedia:**
   - `/mqtt/overview` $\rightarrow$ dikomposisikan dari `GET /api/v1/mqtt/dynamic-security/status` + `GET /api/v1/mqtt/configuration/status` (+ `/clients` untuk jumlah klien).
   - `/system/audit` $\rightarrow$ `GET /api/v1/access-control/audit`.
   - `/operational-events` (global) $\rightarrow$ agregasi per-device melalui `GET /api/v1/operational-events/:deviceId` (dan ekspor per-device `GET /api/v1/operational-events/:deviceId/export`).
   - `/quality/rejects` (global) $\rightarrow$ `GET /api/v1/quality/rejects/:device_id`.
   - `/oee/hourly` $\rightarrow$ `GET /api/v1/telemetry/:device_id/hourly`.
   - `/access-control/info` $\rightarrow$ mengekspos metadata mode (`enforce` / `shadow` / `partial`) dan `authzVersion` melalui `GET /api/v1/access-control/info` (serta `/api/v1/auth/me` untuk proyeksi capability sesi aktif).
   - `/mqtt/configuration/versions` $\rightarrow$ `GET /api/v1/mqtt/configuration/configurations`.
5. **Penghapusan Field Tanpa Dukungan Backend (No Synthetic Data):**
   - **Machine:** tidak menampilkan `line` atau `status`.
   - **Product:** tidak menampilkan `category`, `description`, atau `active_orders_count`.
   - **Operator:** tidak menampilkan `employee_code`, `email`, atau `department`; menggunakan `operator_id` (`ADM-001` sebagai root admin terproteksi) dan opsional `shift_preference`.
   - **Device Health:** hanya menampilkan 7 field terdukung (`last_seen_at`, `cache_age_sec`, `telemetry_rate_hz`, `mqtt_connected`, `buffer_depth`, `firmware_version`, `ip_address`) serta menangani *cache miss* (`cache_age_sec >= 999999`) secara eksplisit; tidak menampilkan `wifi_rssi`, `uptime_sec`, atau `free_heap_bytes`.
   - **System Health:** tidak menampilkan `fastify_version`, `pool_active`, `pool_max`, atau `records_per_second`.
   - **Broker Overview & Config:** tidak menampilkan `uptime_seconds` atau throughput `msg/s` yang tidak tersedia.
   - **Unbound Machine & Empty Quality Rejects:** mesin tanpa `bound_device_id` (mis. `mach-grind-05`) menampilkan status kosong jujur; perangkat tanpa data reject menampilkan `"Tidak ada reject pada periode ini"`.

---

## 2. Aktor & Perimeter Jaringan

| Aktor | Perimeter | Hak Akses UI |
|---|---|---|
| `ADMIN` | LAN Pabrik | Akses penuh semua modul, termasuk IAM & MQTT Dynamic Security |
| `SUPERVISOR` | LAN Pabrik | Monitoring, Analitik, Work Order, Operator roster/rotasi password, Refresh Rekonsiliasi, baca Konfigurasi Broker |
| `OPERATOR` | LAN Pabrik | Baca Overview/Live State/Downtime/Telemetri, Ack Operational Event, Dispatch & Complete Work Order, Label Downtime |
| `MAINTENANCE` | LAN Pabrik | Baca status perangkat/kesehatan, downtime, telemetri, operational events |
| Remote Viewer (Semua Role) | Ingress Tunnel (`:8080` / Remote) | **Mode Observasi (Read-Only):** seluruh mutasi dinonaktifkan di UI, menu IAM disembunyikan |

---

## 3. Matriks Endpoint Backend Admin Panel (`ADMIN_ENDPOINTS`)

Seluruh endpoint berikut didefinisikan di `src/services/api/endpoints.ts` dan dipanggil oleh `src/services/api/client.ts`.

### 3.1 Health, WebSocket, & Auth
| Key | Method | Path | Halaman / Penggunaan |
|---|---|---|---|
| `HEALTH` | `GET` | `/health` | Overview, System Health |
| `WS_TELEMETRY` | `WS` | `/ws/telemetry` | Live State, stream telemetri |
| `AUTH_LOGIN` | `POST` | `/api/v1/auth/login` | Login Page (`AuthContext`) |
| `AUTH_REFRESH` | `POST` | `/api/v1/auth/refresh` | `apiClient` session refresh |

### 3.2 Aset: Edge Devices & Machines
| Key | Method | Path | Halaman / Penggunaan |
|---|---|---|---|
| `DEVICES_LIST` | `GET` | `/api/v1/devices` | Overview, Devices, Machines, Operational Events, Telemetry, Quality |
| `DEVICES_GET` | `GET` | `/api/v1/devices/:id` | Detail Device |
| `DEVICES_CREATE` | `POST` | `/api/v1/devices` | Devices |
| `DEVICES_UPDATE` | `PUT` | `/api/v1/devices/:id` | Devices |
| `DEVICES_DELETE` | `DELETE` | `/api/v1/devices/:id` | Devices |
| `DEVICES_HEALTH` | `GET` | `/api/v1/devices/:id/health` | `DeviceHealthDrawer` |
| `MACHINES_LIST` | `GET` | `/api/v1/machines` | Overview, Machines, Work Orders, OEE Analytics |
| `MACHINES_GET` | `GET` | `/api/v1/machines/:id` | Detail Machine |
| `MACHINES_CREATE` | `POST` | `/api/v1/machines` | Machines |
| `MACHINES_UPDATE` | `PUT` | `/api/v1/machines/:id` | Machines |
| `MACHINES_DELETE` | `DELETE` | `/api/v1/machines/:id` | Machines |
| `MACHINES_BIND` | `POST` | `/api/v1/machines/:id/bind` | Machines |
| `MACHINES_UNBIND` | `POST` | `/api/v1/machines/:id/unbind` | Machines |

### 3.3 Master Produksi & Work Orders
| Key | Method | Path | Halaman / Penggunaan |
|---|---|---|---|
| `PRODUCTS_LIST` | `GET` | `/api/v1/products` | Products, Work Order Wizard |
| `PRODUCTS_CREATE` | `POST` | `/api/v1/products` | Products |
| `PRODUCTS_UPDATE` | `PUT` | `/api/v1/products/:id` | Products |
| `PRODUCTS_DELETE` | `DELETE` | `/api/v1/products/:id` | Products |
| `OPERATORS_LIST` | `GET` | `/api/v1/operators` | Operators, Work Order Wizard, Access Control |
| `OPERATORS_CREATE` | `POST` | `/api/v1/operators` | Operators |
| `OPERATORS_UPDATE` | `PUT` | `/api/v1/operators/:id` | Operators |
| `OPERATORS_DELETE` | `DELETE` | `/api/v1/operators/:id` | Operators |
| `OPERATORS_PASSWORD` | `PATCH` | `/api/v1/operators/:id/password` | Operators |
| `OPERATORS_STATUS` | `PATCH` | `/api/v1/operators/:id/status` | Operators |
| `WORK_ORDERS_LIST` | `GET` | `/api/v1/work-orders` | Overview, Work Orders |
| `WORK_ORDERS_GET` | `GET` | `/api/v1/work-orders/:wo_id` | Detail Work Order |
| `WORK_ORDERS_RESOLVE` | `GET` | `/api/v1/work-orders/:wo_id/resolve` | Resolusi konteks 4-Zone Work Order |
| `WORK_ORDERS_VALIDATE_ZONE` | `POST` | `/api/v1/work-orders/validate-zone` | `WorkOrderWizardModal` |
| `WORK_ORDERS_INITIATE` | `POST` | `/api/v1/work-orders/initiate-from-zones` | `WorkOrderWizardModal` |
| `WORK_ORDERS_DISPATCH` | `POST` | `/api/v1/work-orders/:wo_id/dispatch` | Work Orders (`PENDING` $\rightarrow$ `ACTIVE`) |
| `WORK_ORDERS_COMPLETE` | `POST` | `/api/v1/work-orders/:wo_id/complete` | Work Orders (`ACTIVE` $\rightarrow$ `COMPLETED`) |
| `WORK_ORDERS_CANCEL` | `POST` | `/api/v1/work-orders/:wo_id/cancel` | Work Orders (`PENDING`/`ACTIVE` $\rightarrow$ `ABORTED`) |

### 3.4 Monitoring: Live State, Downtime, & Operational Events
| Key | Method | Path | Halaman / Penggunaan |
|---|---|---|---|
| `LIVE_STATE` | `GET` | `/api/v1/live-state` | Live State |
| `DOWNTIME_ACTIVE` | `GET` | `/api/v1/downtime-events/active` | Overview, Downtime Events |
| `DOWNTIME_BY_DEVICE` | `GET` | `/api/v1/downtime-events/:device_id` | Downtime Events (filter per device) |
| `DOWNTIME_HISTORY` | `GET` | `/api/v1/downtime` | Downtime Events (historis + cursor pagination) |
| `DOWNTIME_EXPORT` | `GET` | `/api/v1/downtime/export` | Ekspor CSV/JSON downtime lintas mesin |
| `DOWNTIME_DEVICE_EXPORT` | `GET` | `/api/v1/downtime/:device_id/export` | Ekspor CSV/JSON downtime per perangkat |
| `DOWNTIME_REASON` | `POST` | `/api/v1/downtime-events/:id/reason` | `DowntimeReasonModal` |
| `OPERATIONAL_EVENTS_BY_DEVICE` | `GET` | `/api/v1/operational-events/:deviceId` | Overview (agregasi per-device), Operational Events |
| `OPERATIONAL_EVENTS_DEVICE_EXPORT` | `GET` | `/api/v1/operational-events/:deviceId/export` | Ekspor CSV/JSON operational events per device |
| `OPERATIONAL_EVENTS_ACK` | `PATCH` | `/api/v1/operational-events/:id/ack` | Operational Events |

### 3.5 Telemetri, OEE, Kualitas, & Rekonsiliasi
| Key | Method | Path | Halaman / Penggunaan |
|---|---|---|---|
| `TELEMETRY_HISTORY` | `GET` | `/api/v1/telemetry/:device_id/history` | Telemetry History (cursor pagination) |
| `TELEMETRY_HOURLY` | `GET` | `/api/v1/telemetry/:device_id/hourly` | OEE Analytics (tren per jam) |
| `TELEMETRY_AGGREGATE` | `GET` | `/api/v1/telemetry/:device_id/aggregate` | Telemetry History (summary KPI) |
| `TELEMETRY_EXPORT` | `GET` | `/api/v1/telemetry/:device_id/export` | Telemetry History (CSV/JSON export) |
| `RECONCILIATION_JOBS` | `GET` | `/api/v1/telemetry/reconciliation/jobs` | Data Reconciliation |
| `RECONCILIATION_REFRESH` | `POST` | `/api/v1/telemetry/reconciliation/refresh` | Data Reconciliation |
| `OEE_SHIFT_SUMMARY` | `GET` | `/api/v1/oee/shift-summary` | OEE Analytics |
| `OEE_SHIFT_TIMELINE` | `GET` | `/api/v1/oee/shift-timeline` | OEE Analytics |
| `QUALITY_REJECTS_BY_DEVICE` | `GET` | `/api/v1/quality/rejects/:device_id` | Quality & Rejects |

### 3.6 Access Control (IAM) & Audit (18 Rute Otoritatif)
| Key | Method | Path | Halaman / Penggunaan |
|---|---|---|---|
| `IAM_INFO` | `GET` | `/api/v1/access-control/info` | Access Control (mode ABAC & `authzVersion`) |
| `IAM_ROLES_LIST` | `GET` | `/api/v1/access-control/roles` | Access Control, Operators |
| `IAM_ROLES_CREATE` | `POST` | `/api/v1/access-control/roles` | Access Control (custom role maks. level 29) |
| `IAM_ROLES_UPDATE` | `PUT` | `/api/v1/access-control/roles/:id` | Access Control (blokir role sistem `403 SYSTEM_ROLE_PROTECTED`) |
| `IAM_ROLES_DELETE` | `DELETE` | `/api/v1/access-control/roles/:id` | Access Control (blokir role sistem `403` & role aktif `409 ROLE_IN_USE`) |
| `IAM_ROLE_PERMISSIONS_ADD` | `POST` | `/api/v1/access-control/roles/:id/permissions` | Access Control (tolak reserved permission & duplikat) |
| `IAM_ROLE_PERMISSIONS_DELETE` | `DELETE` | `/api/v1/access-control/roles/:id/permissions/:permissionId` | Access Control (cabut permission role; proteksi `ADMIN`) |
| `IAM_PERMISSIONS_LIST` | `GET` | `/api/v1/access-control/permissions` | Access Control (Permission Catalog READ-ONLY) |
| `IAM_PERMISSIONS_CREATE` | `POST` | `/api/v1/access-control/permissions` | **FORBIDDEN (`403 PERMISSION_CATALOG_READ_ONLY`)** — master data tetap |
| `IAM_USER_ROLES_LIST` | `GET` | `/api/v1/access-control/user-roles` | Access Control, Operators |
| `IAM_USER_ROLES_CREATE` | `POST` | `/api/v1/access-control/user-roles` | Access Control, Operators (multi-role & scope assignment) |
| `IAM_USER_ROLES_DELETE` | `DELETE` | `/api/v1/access-control/user-roles` | Access Control, Operators (proteksi `ADM-001` `ADMIN`) |
| `IAM_POLICIES_LIST` | `GET` | `/api/v1/access-control/policies` | Access Control |
| `IAM_POLICIES_CREATE` | `POST` | `/api/v1/access-control/policies` | Access Control (anti-lockout `ADMIN` & anti-escalation) |
| `IAM_POLICIES_UPDATE` | `PUT` | `/api/v1/access-control/policies/:id` | Access Control (update/toggle policy) |
| `IAM_POLICIES_DELETE` | `DELETE` | `/api/v1/access-control/policies/:id` | Access Control (blokir hapus policy `ADMIN`) |
| `IAM_SUBJECT_EFFECTIVE_PERMISSIONS` | `GET` | `/api/v1/access-control/subjects/:operatorId/effective-permissions` | Access Control (Subject Inspector) |
| `IAM_AUDIT` | `GET` | `/api/v1/access-control/audit` | Access Control, Audit Trail |

**Aturan Keamanan IAM Terverifikasi:**
- **Permission Catalog Tetap (Fixed Master Data):** UI hanya menyediakan operasi READ pada Permission Catalog. Operasi CREATE/UPDATE/DELETE dilarang, dan pemanggilan `POST /api/v1/access-control/permissions` mengembalikan `403 PERMISSION_CATALOG_READ_ONLY`.
- **Proteksi Role Sistem & Konflik Relasi:** Role sistem (`ADMIN`, `SUPERVISOR`, `OPERATOR`, `MAINTENANCE`) dikunci dari `PUT` dan `DELETE`. Custom role yang masih memiliki penugasan operator mengembalikan `409 ROLE_IN_USE` saat dihapus.
- **Anti-Lockout & Reserved Permissions:** Reserved permissions (`manage:access_control`, `manage:mqtt_admin`, `manage:mqtt_configuration`, `read_raw:mqtt_configuration`) serta wildcard `*` ditolak (`403 PRIVILEGE_ESCALATION_DENIED`) untuk custom role. Policy `DENY` atau penonaktifan pada `ADMIN` ditolak.
- **Stale Token Invalidation:** Setiap mutasi role/permission/assignment menaikkan `authzVersion` sehingga token sesi lama otomatis ditolak dengan `401 AUTHZ_VERSION_STALE`.

### 3.7 MQTT Dynamic Security & Broker Configuration Manager
| Key | Method | Path | Halaman / Penggunaan |
|---|---|---|---|
| `MQTT_DYNSEC_STATUS` | `GET` | `/api/v1/mqtt/dynamic-security/status` | Broker Overview, Dynamic Security |
| `MQTT_DYNSEC_CLIENTS_LIST` | `GET` | `/api/v1/mqtt/dynamic-security/clients` | Broker Overview, Dynamic Security |
| `MQTT_DYNSEC_CLIENTS_CREATE` | `POST` | `/api/v1/mqtt/dynamic-security/clients` | Dynamic Security |
| `MQTT_DYNSEC_CLIENTS_DELETE` | `DELETE` | `/api/v1/mqtt/dynamic-security/clients/:username` | Dynamic Security |
| `MQTT_DYNSEC_CLIENTS_STATUS` | `PATCH` | `/api/v1/mqtt/dynamic-security/clients/:username/status` | Dynamic Security |
| `MQTT_DYNSEC_CLIENTS_PASSWORD` | `PATCH` | `/api/v1/mqtt/dynamic-security/clients/:username/password` | Dynamic Security |
| `MQTT_DYNSEC_ROLES_LIST` | `GET` | `/api/v1/mqtt/dynamic-security/roles` | Dynamic Security |
| `MQTT_DYNSEC_ROLES_CREATE` | `POST` | `/api/v1/mqtt/dynamic-security/roles` | Dynamic Security |
| `MQTT_DYNSEC_ROLES_DELETE` | `DELETE` | `/api/v1/mqtt/dynamic-security/roles/:rolename` | Dynamic Security |
| `MQTT_DYNSEC_GROUPS_LIST` | `GET` | `/api/v1/mqtt/dynamic-security/groups` | Dynamic Security |
| `MQTT_DYNSEC_GROUPS_CREATE` | `POST` | `/api/v1/mqtt/dynamic-security/groups` | Dynamic Security |
| `MQTT_DYNSEC_GROUPS_DELETE` | `DELETE` | `/api/v1/mqtt/dynamic-security/groups/:groupname` | Dynamic Security |
| `MQTT_DYNSEC_PROVISION` | `POST` | `/api/v1/mqtt/dynamic-security/provision` | Dynamic Security |
| `MQTT_CONFIG_GET` | `GET` | `/api/v1/mqtt/configuration` | Broker Configuration Manager |
| `MQTT_CONFIG_RAW` | `GET` | `/api/v1/mqtt/configuration/raw` | Broker Configuration Manager (Review tab) |
| `MQTT_CONFIG_STATUS` | `GET` | `/api/v1/mqtt/configuration/status` | Broker Overview, Broker Configuration Manager |
| `MQTT_CONFIG_STAGE` | `POST` | `/api/v1/mqtt/configuration/configurations` | Broker Configuration Manager |
| `MQTT_CONFIG_LIST` | `GET` | `/api/v1/mqtt/configuration/configurations` | Broker Configuration Manager |
| `MQTT_CONFIG_VERSION_GET` | `GET` | `/api/v1/mqtt/configuration/configurations/:versionId` | Broker Configuration Manager |
| `MQTT_CONFIG_VERSION_DIFF` | `GET` | `/api/v1/mqtt/configuration/configurations/:versionId/diff` | Broker Configuration Manager |
| `MQTT_CONFIG_VERSION_DELETE` | `DELETE` | `/api/v1/mqtt/configuration/configurations/:versionId` | Broker Configuration Manager |
| `MQTT_CONFIG_VERSION_APPLY` | `POST` | `/api/v1/mqtt/configuration/configurations/:versionId/apply` | Broker Configuration Manager |
| `MQTT_CONFIG_VERSION_ROLLBACK` | `POST` | `/api/v1/mqtt/configuration/configurations/:versionId/rollback` | Broker Configuration Manager |
| `MQTT_CONFIG_OPERATIONS` | `GET` | `/api/v1/mqtt/configuration/operations` | Broker Configuration Manager |
| `MQTT_CONFIG_OPERATION_GET` | `GET` | `/api/v1/mqtt/configuration/operations/:operationId` | Broker Configuration Manager |
| `MQTT_CONFIG_BACKUPS` | `GET` | `/api/v1/mqtt/configuration/backups` | Broker Configuration Manager |

---

## 4. State Machine Work Order

```
  [PENDING] ──(POST /api/v1/work-orders/:wo_id/dispatch)──▶ [ACTIVE]
      │                                                         │
      │ (POST .../cancel, ADMIN only)                           ├──(POST .../complete)──▶ [COMPLETED]
      ▼                                                         │
  [ABORTED] ◀────────(POST .../cancel, ADMIN only)──────────────┘
```

- Hanya `PENDING` dan `ACTIVE` yang diperhitungkan dalam deteksi konflik mesin pada 4-Zone Wizard (`validateFourZones`) dan proteksi penghapusan Product.
- Label UI, filter dropdown, dan badge hanya menggunakan empat status tersebut.

---

## 5. Penanganan Ketidaktersediaan Data & Degradasi Jujur

- **Device Health Cache Miss:** Bila `cache_age_sec >= 999999`, `DeviceHealthDrawer` menampilkan indikator bahwa cache kesehatan perangkat belum tersedia (*Telemetry cache miss*).
- **Unbound Machine:** Bila `machine.bound_device_id === null` (mis. `mach-grind-05`), `OeeAnalyticsPage` tidak meminta `/api/v1/telemetry/:device_id/hourly` dengan ID palsu dan menampilkan pemberitahuan bahwa mesin belum terikat ke Edge Device.
- **Empty Quality Rejects:** Bila `pareto.length === 0`, `QualityRejectsPage` menampilkan `"Tidak ada reject pada periode ini"`.
- **Authz Metadata & Scope:** `AccessControlPage` membaca `GET /api/v1/access-control/info` untuk menampilkan mode evaluasi (`enforce` / `shadow` / `partial`) serta `authzVersion`. Penugasan non-`ORGANIZATION` (`SITE`, `AREA`, `LINE`, `MACHINE`, `DEVICE`) dicatat sebagai penugasan persiapan (*preparatory*), sedangkan hanya scope `ORGANIZATION` yang aktif memberikan hak akses pada Admin Panel.
- **Client-Side Per-Device Aggregation:** `OverviewPage` dan `OperationalEventsPage` melakukan agregasi dari `GET /api/v1/operational-events/:deviceId` untuk seluruh perangkat yang terdata ketika pengguna memilih tampilan lintas perangkat.
