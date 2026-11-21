# Audit API Live vs Admin Panel — Fase 1 (tanpa autentikasi)

| | |
|---|---|
| **Tanggal** | 2026-11-19 (probe 15:41–16:00 WIB) |
| **Backend live** | `https://oee.fadik.web.id` (Fathur: "backend api sudah diperbarui", 19 Nov 15:41 WIB) |
| **Panel** | Real mode (`.env` lokal: `VITE_API_URL=https://oee.fadik.web.id/api/v1`, `VITE_WS_URL=wss://oee.fadik.web.id/ws/telemetry`) |
| **Registry panel** | 137 operasi (`src/services/api/endpoints.ts` + submodul) |
| **Sumber kebenaran** | API LIVE — bila perilaku live bertentangan dengan api_docs (`~/workspace/user/files/pasted-text.txt`), live yang menang dan dokumen dicatat usang |
| **Metode** | 4 worker paralel (Auth/IAM/System, Master data/Devices/WO, Monitoring/Telemetry/MQTT, Shape Check) + verifikasi panel-side oleh koordinator. Probe tanpa header Authorization; mutasi tanpa body (hanya membuktikan keberadaan rute dari responsnya); login TIDAK diprobe (bukti §27 dipakai); tanpa ubah kode, tanpa push, tanpa sentuhan Linear |

## 1. Ringkasan hitungan

144 baris probe (137 registry + 7 discovery). Semua 137 operasi registry terprobe; 0 hilang.

| Status HTTP | Jumlah | Arti |
|---|---|---|
| 401 UNAUTHORIZED | 58 | Rute ada + tergating (terbanyak — wajar tanpa auth) |
| 400 VALIDATION_ERROR | 47 | Rute ada; validasi jalan sebelum auth |
| 200 | 14 | Publik, body tersimpan + shape-check |
| 404 | 17 | 6 domain `*_NOT_FOUND` (rute ada, resource tidak ada) + 4 GET atas rute POST-only (inkonklusif) + 2 hilang-benar (penghapusan yang benar) + 1 GET atas path WS (bukan cara uji WS) + 4 lainnya (lihat matriks) |
| 403 FORBIDDEN | 4 | Rute ada; gate tunnel/actuation bekerja |
| 502 | 1 | `MQTT_DYNSEC_CLIENTS_ENABLE` — satu-satunya 5xx (N-1) |
| — (dilewati) | 3 | Login/refresh/change-password (aturan keras; bukti §27) |

| Verdict | Jumlah |
|---|---|
| EXISTS_GATED | 119 |
| EXISTS_PUBLIC | 14 |
| ERROR_500 (502) | 1 |
| MISSING (benar-benar hilang — keduanya penghapusan yang benar) | 2 |
| OTHER (GET atas rute POST-only, inkonklusif) | 4 |
| WS_UNTESTABLE | 1 |
| SKIPPED_LOGIN | 3 |

Per irisan: A (Auth/IAM/System/Health) 26 baris — 21 gated, 1 publik, 1 WS, 3 dilewati, 0 hilang, 0 5xx. B (Devices/Machines/Operators/Production/Products/WO) 53 baris (48 tugas + 5 discovery) — 48/48 endpoint tugas ada, 0 5xx. C (Monitoring/Telemetry/OEE/Quality/MQTT) 65 baris (63 registry + 2 discovery) — 63/63 registry ada, 1 502. Shape: 9/9 endpoint publik KOMPATIBEL, 0 memecahkan mapper.

## 2. Matriks per-endpoint (144 baris)

| Key | Method | Template | Status | Verdict | Bukti |
|---|---|---|---|---|---|
| AUTH_ME | GET | `/api/v1/auth/me` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Token validation failed: missing or invalid Bearer token"} |
| SYSTEM_ACCESS_MODE | GET | `/api/v1/system/access-mode` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Token validation failed: missing or invalid Bearer token"} |
| HEALTH | GET | `/health` | 200 | EXISTS_PUBLIC | {"status":"ok","uptime":979.194684463,"timestamp":"2026-11-19T08:43:39.089Z","ws_clients":1,"db_connected":true,"buff... |
| HEALTH_DETAIL | GET | `/health/detail` | 403 | EXISTS_GATED | {"error":"FORBIDDEN","message":"Health detail is not available through remote tunnel ingress."} |
| IAM_INFO | GET | `/api/v1/access-control/info` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| IAM_ROLES_LIST | GET | `/api/v1/access-control/roles` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| IAM_ROLES_CREATE | POST | `/api/v1/access-control/roles` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| IAM_ROLES_UPDATE | PUT | `/api/v1/access-control/roles/probe-000` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"params/id Invalid UUID","issues":[{"keyword":"invalid_format","instancePath":"... |
| IAM_ROLES_DELETE | DELETE | `/api/v1/access-control/roles/probe-000` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"params/id Invalid UUID","issues":[{"keyword":"invalid_format","instancePath":"... |
| IAM_ROLE_PERMISSIONS_ADD | POST | `/api/v1/access-control/roles/probe-000/permissions` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"params/id Invalid UUID","issues":[{"keyword":"invalid_format","instancePath":"... |
| IAM_ROLE_PERMISSIONS_DELETE | DELETE | `/api/v1/access-control/roles/probe-000/permissions/probe-000` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"params/id Invalid UUID, params/permissionId Invalid UUID","issues":[{"keyword"... |
| IAM_PERMISSIONS_LIST | GET | `/api/v1/access-control/permissions` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| IAM_PERMISSIONS_CREATE | POST | `/api/v1/access-control/permissions` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| IAM_USER_ROLES_LIST | GET | `/api/v1/access-control/user-roles` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| IAM_USER_ROLES_CREATE | POST | `/api/v1/access-control/user-roles` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| IAM_USER_ROLES_DELETE | DELETE | `/api/v1/access-control/user-roles` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| IAM_POLICIES_LIST | GET | `/api/v1/access-control/policies` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| IAM_POLICIES_CREATE | POST | `/api/v1/access-control/policies` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| IAM_POLICIES_UPDATE | PUT | `/api/v1/access-control/policies/probe-000` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| IAM_POLICIES_DELETE | DELETE | `/api/v1/access-control/policies/probe-000` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"params/id Invalid UUID","issues":[{"keyword":"invalid_format","instancePath":"... |
| IAM_SUBJECT_EFFECTIVE_PERMISSIONS | GET | `/api/v1/access-control/subjects/OP-PROBE/effective-permissions` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| IAM_AUDIT | GET | `/api/v1/access-control/audit` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| WS_TELEMETRY | GET | `/ws/telemetry` | 404 | WS_UNTESTABLE |  |
| AUTH_LOGIN | POST | `/api/v1/auth/login` | None | SKIPPED_LOGIN |  |
| AUTH_REFRESH | POST | `/api/v1/auth/refresh` | None | SKIPPED_LOGIN |  |
| AUTH_CHANGE_PASSWORD | POST | `/api/v1/auth/password/change` | None | SKIPPED_LOGIN |  |
| DEVICES_LIST | GET | `/api/v1/devices` | 200 | EXISTS_PUBLIC | [{"deviceId":"STM32-OEE-SIM","model":"STM32-SIMULATOR","macAddress":"00:08:DC:55:01:FF","ipAddress":"192.168.1.150","... |
| DEVICES_GET | GET | `/api/v1/devices/:deviceId` | 404 | EXISTS_GATED | {"error":"DEVICE_NOT_FOUND","message":"Device PROBE-000 was not found."} |
| DEVICES_HEALTH | GET | `/api/v1/devices/:deviceId/health` | 404 | EXISTS_GATED | {"error":"DEVICE_NOT_FOUND","message":"Device PROBE-000 was not found."} |
| DEVICES_CREATE | POST | `/api/v1/devices` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| DEVICES_PROVISION | POST | `/api/v1/devices/provision` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| DEVICES_REVOKE | POST | `/api/v1/devices/:deviceId/revoke` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| DEVICES_CREDENTIALS | POST | `/api/v1/devices/:deviceId/credentials` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| DEVICES_UPDATE | PUT | `/api/v1/devices/:deviceId` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| DEVICES_DELETE | DELETE | `/api/v1/devices/:deviceId` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MACHINES_LIST | GET | `/api/v1/machines` | 200 | EXISTS_PUBLIC | [{"machineId":"CNC-MILLING-SIM","machineName":"Milling 5-Axis CNC (Simulation)","lineId":"LINE-01","deviceId":"STM32-... |
| MACHINES_GET | GET | `/api/v1/machines/:machineId` | 404 | EXISTS_GATED | {"error":"MACHINE_NOT_FOUND","message":"Machine CNC-PROBE-000 not found."} |
| MACHINES_CREATE | POST | `/api/v1/machines` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| MACHINES_UPDATE | PUT | `/api/v1/machines/:machineId` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| MACHINES_DELETE | DELETE | `/api/v1/machines/:machineId` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MACHINES_BIND | POST | `/api/v1/machines/:machineId/bind` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| MACHINES_UNBIND | POST | `/api/v1/machines/:machineId/unbind` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MACHINES_STATUS_HISTORY | GET | `/api/v1/machines/:machineId/status-history` | 404 | EXISTS_GATED | {"error":"MACHINE_NOT_FOUND","message":"Machine CNC-PROBE-000 not found."} |
| OPERATORS_LIST | GET | `/api/v1/operators` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| OPERATORS_GET | GET | `/api/v1/operators/:id` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| OPERATORS_CREATE | POST | `/api/v1/operators` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| OPERATORS_UPDATE | PUT | `/api/v1/operators/:id` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| OPERATORS_DELETE | DELETE | `/api/v1/operators/:id` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| OPERATORS_PASSWORD | PATCH | `/api/v1/operators/:id/password` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| OPERATORS_STATUS | PATCH | `/api/v1/operators/:id/status` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| PRODUCTION_LINES_LIST | GET | `/api/v1/production-lines` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| PRODUCTION_LINES_GET | GET | `/api/v1/production-lines/:lineId` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| PRODUCTION_LINES_CREATE | POST | `/api/v1/production-lines` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| PRODUCTION_LINES_UPDATE | PATCH | `/api/v1/production-lines/:lineId` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| PRODUCTION_LINES_DELETE | DELETE | `/api/v1/production-lines/:lineId` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| SHIFTS_LIST | GET | `/api/v1/shifts` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| SHIFTS_GET | GET | `/api/v1/shifts/:shiftId` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| SHIFTS_CREATE | POST | `/api/v1/shifts` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| SHIFTS_UPDATE | PATCH | `/api/v1/shifts/:shiftId` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| SHIFTS_DELETE | DELETE | `/api/v1/shifts/:shiftId` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| SHIFT_SCHEDULES_LIST | GET | `/api/v1/shift-schedules` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| SHIFT_SCHEDULES_GET | GET | `/api/v1/shift-schedules/:scheduleId` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| SHIFT_SCHEDULES_CREATE | POST | `/api/v1/shift-schedules` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| SHIFT_SCHEDULES_UPDATE | PATCH | `/api/v1/shift-schedules/:scheduleId` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| SHIFT_SCHEDULES_DELETE | DELETE | `/api/v1/shift-schedules/:scheduleId` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| PRODUCTS_LIST | GET | `/api/v1/products` | 200 | EXISTS_PUBLIC | [{"productId":"PRD-COUPLING-M10","productName":"Flexible Motor Coupling M10","stdCycleTimeSec":"10.00","createdAt":"2... |
| PRODUCTS_GET | GET | `/api/v1/products/:productId` | 404 | EXISTS_GATED | {"error":"PRODUCT_NOT_FOUND","message":"Product PRD-PROBE not found."} |
| PRODUCTS_CREATE | POST | `/api/v1/products` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| PRODUCTS_UPDATE | PUT | `/api/v1/products/:productId` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| PRODUCTS_DELETE | DELETE | `/api/v1/products/:productId` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| WORK_ORDERS_LIST | GET | `/api/v1/work-orders` | 200 | EXISTS_PUBLIC | [{"wo_id":"WO-SIM-20260906-02","machine_id":"CNC-MILLING-SIM","machine_name":"Milling 5-Axis CNC (Simulation)","produ... |
| WORK_ORDERS_GET | GET | `/api/v1/work-orders/:wo_id` | 404 | EXISTS_GATED | {"error":"WO_NOT_FOUND","message":"Work Order WO-PROBE-000 does not exist."} |
| WORK_ORDERS_RESOLVE | GET | `/api/v1/work-orders/:wo_id/resolve` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"querystring/device_id Invalid input: expected string, received undefined","iss... |
| WORK_ORDERS_CANCEL | POST | `/api/v1/work-orders/:wo_id/cancel` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| DISCOVERY_DEVICES_COMMAND_GET | GET | `/api/v1/devices/:deviceId/command` | 403 | EXISTS_GATED | {"error":"FORBIDDEN","message":"Operational actions and machine actuation are strictly forbidden from remote tunnel i... |
| DISCOVERY_WO_DISPATCH_GET | GET | `/api/v1/work-orders/:wo_id/dispatch` | 404 | OTHER | {"message":"Route GET:/api/v1/work-orders/WO-PROBE-000/dispatch not found","error":"Not Found","statusCode":404} |
| DISCOVERY_WO_COMPLETE_GET | GET | `/api/v1/work-orders/:wo_id/complete` | 404 | OTHER | {"message":"Route GET:/api/v1/work-orders/WO-PROBE-000/complete not found","error":"Not Found","statusCode":404} |
| DISCOVERY_WO_VALIDATE_ZONE_GET | GET | `/api/v1/work-orders/validate-zone` | 404 | OTHER | {"error":"WO_NOT_FOUND","message":"Work Order validate-zone does not exist."} |
| DISCOVERY_WO_INITIATE_ZONES_GET | GET | `/api/v1/work-orders/initiate-from-zones` | 404 | OTHER | {"error":"WO_NOT_FOUND","message":"Work Order initiate-from-zones does not exist."} |
| LIVE_STATE | GET | `/api/v1/live-state` | 200 | EXISTS_PUBLIC | [{"deviceId":"STM32-OEE-SIM","machineId":"CNC-MILLING-SIM","machineName":"Milling 5-Axis CNC (Simulation)","woId":"WO... |
| LIVE_STATE_BY_DEVICE | GET | `/api/v1/live-state/:deviceId` | 404 | EXISTS_GATED | {"error":"Not Found","message":"Live state for device PROBE-000 not found"} |
| DOWNTIME_ACTIVE | GET | `/api/v1/downtime-events/active` | 200 | EXISTS_PUBLIC | [] |
| DOWNTIME_BY_DEVICE | GET | `/api/v1/downtime-events/:device_id` | 200 | EXISTS_PUBLIC | [] |
| DOWNTIME_DEVICE_EXPORT | GET | `/api/v1/downtime-events/:device_id/export` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| DOWNTIME_REASON | POST | `/api/v1/downtime-events/:id/reason` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"params/id Invalid input: expected number, received NaN","issues":[{"keyword":"... |
| OPERATIONAL_EVENTS_LIST | GET | `/api/v1/operational-events` | 200 | EXISTS_PUBLIC | [{"id":1070,"recordedAt":"2026-11-19T08:45:49.144Z","deviceId":"STM32-OEE-SIM","machineId":"CNC-MILLING-SIM","woId":n... |
| OPERATIONAL_EVENTS_BY_DEVICE | GET | `/api/v1/operational-events/:deviceId` | 200 | EXISTS_PUBLIC | [] |
| OPERATIONAL_EVENTS_EXPORT | GET | `/api/v1/operational-events/export` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| OPERATIONAL_EVENTS_DEVICE_EXPORT | GET | `/api/v1/operational-events/:deviceId/export` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| OPERATIONAL_EVENTS_ACK | PATCH | `/api/v1/operational-events/:id/ack` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"params/id Invalid input: expected number, received NaN","issues":[{"keyword":"... |
| SYSTEM_AUDIT | GET | `/api/v1/system/audit` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| SYSTEM_AUDIT_EXPORT | GET | `/api/v1/system/audit/export` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| TELEMETRY_HISTORY | GET | `/api/v1/telemetry/:device_id` | 404 | EXISTS_GATED | {"error":"DEVICE_NOT_FOUND","message":"PROBE-000"} |
| TELEMETRY_HOURLY | GET | `/api/v1/telemetry/:device_id/hourly` | 404 | EXISTS_GATED | {"error":"DEVICE_NOT_FOUND","message":"PROBE-000"} |
| TELEMETRY_AGGREGATE | GET | `/api/v1/telemetry/:device_id/aggregate` | 200 | EXISTS_PUBLIC | [] |
| TELEMETRY_ROLLUP | GET | `/api/v1/telemetry/rollup` | 200 | EXISTS_PUBLIC | {"data":[],"meta":{"limit":500,"hasMore":false,"nextCursor":null,"count":0}} |
| TELEMETRY_EXPORT | GET | `/api/v1/telemetry/:device_id/export` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| TELEMETRY_HOURLY_EXPORT | GET | `/api/v1/telemetry/:device_id/hourly/export` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| RECONCILIATION_JOBS | GET | `/api/v1/telemetry/reconciliation/jobs` | 200 | EXISTS_PUBLIC | [{"jobId":1,"applicationName":"Telemetry Reporter [1]","scheduleInterval":"24:00:00","maxRuntime":"00:01:40","lastRun... |
| RECONCILIATION_REFRESH | POST | `/api/v1/telemetry/reconciliation/refresh` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| OEE_SHIFT_SUMMARY | GET | `/api/v1/oee/shift-summary` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"machine_id or device_id is required."} |
| OEE_HOURLY | GET | `/api/v1/oee/hourly` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"machine_id or device_id is required."} |
| OEE_SHIFT_TIMELINE | GET | `/api/v1/oee/shift-timeline` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"machine_id or device_id is required."} |
| QUALITY_REJECTS_GLOBAL | GET | `/api/v1/quality/rejects` | 200 | EXISTS_PUBLIC | [] |
| QUALITY_REJECTS_BY_DEVICE | GET | `/api/v1/quality/rejects/:device_id` | 404 | EXISTS_GATED | {"error":"DEVICE_NOT_FOUND","message":"PROBE-000"} |
| MQTT_OVERVIEW | GET | `/api/v1/mqtt/overview` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_DYNSEC_STATUS | GET | `/api/v1/mqtt/dynamic-security/status` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_DYNSEC_CLIENTS_LIST | GET | `/api/v1/mqtt/dynamic-security/clients` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_DYNSEC_CLIENTS_GET | GET | `/api/v1/mqtt/dynamic-security/clients/:name` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_DYNSEC_CLIENTS_CREATE | POST | `/api/v1/mqtt/dynamic-security/clients` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| MQTT_DYNSEC_CLIENTS_DELETE | DELETE | `/api/v1/mqtt/dynamic-security/clients/:name` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_DYNSEC_CLIENTS_PASSWORD | PATCH | `/api/v1/mqtt/dynamic-security/clients/:name/password` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| MQTT_DYNSEC_CLIENTS_ENABLE | PATCH | `/api/v1/mqtt/dynamic-security/clients/:name/enable` | 502 | ERROR_500 | error code: 502 |
| MQTT_DYNSEC_CLIENT_ROLES_ADD | POST | `/api/v1/mqtt/dynamic-security/clients/:name/roles` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| MQTT_DYNSEC_CLIENT_ROLES_DELETE | DELETE | `/api/v1/mqtt/dynamic-security/clients/:name/roles/:rolename` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_DYNSEC_ROLES_LIST | GET | `/api/v1/mqtt/dynamic-security/roles` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_DYNSEC_ROLES_GET | GET | `/api/v1/mqtt/dynamic-security/roles/:name` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_DYNSEC_ROLES_CREATE | POST | `/api/v1/mqtt/dynamic-security/roles` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| MQTT_DYNSEC_ROLES_DELETE | DELETE | `/api/v1/mqtt/dynamic-security/roles/:name` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_DYNSEC_ROLE_ACLS_ADD | POST | `/api/v1/mqtt/dynamic-security/roles/:name/acls` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| MQTT_DYNSEC_ROLE_ACLS_DELETE | DELETE | `/api/v1/mqtt/dynamic-security/roles/:name/acls` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| MQTT_DYNSEC_GROUPS_LIST | GET | `/api/v1/mqtt/dynamic-security/groups` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_DYNSEC_GROUPS_GET | GET | `/api/v1/mqtt/dynamic-security/groups/:name` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_DYNSEC_GROUPS_CREATE | POST | `/api/v1/mqtt/dynamic-security/groups` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| MQTT_DYNSEC_GROUPS_DELETE | DELETE | `/api/v1/mqtt/dynamic-security/groups/:name` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_DYNSEC_GROUP_CLIENTS_ADD | POST | `/api/v1/mqtt/dynamic-security/groups/:name/clients` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| MQTT_DYNSEC_GROUP_CLIENTS_DELETE | DELETE | `/api/v1/mqtt/dynamic-security/groups/:name/clients/:username` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_DYNSEC_GROUP_ROLES_ADD | POST | `/api/v1/mqtt/dynamic-security/groups/:name/roles` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| MQTT_DYNSEC_GROUP_ROLES_DELETE | DELETE | `/api/v1/mqtt/dynamic-security/groups/:name/roles/:rolename` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_CONFIG_GET | GET | `/api/v1/mqtt/configuration/` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_CONFIG_RAW | GET | `/api/v1/mqtt/configuration/raw` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_CONFIG_STATUS | GET | `/api/v1/mqtt/configuration/status` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_CONFIG_STAGE | POST | `/api/v1/mqtt/configuration/configurations` | 400 | EXISTS_GATED | {"error":"VALIDATION_ERROR","message":"body/ Invalid input: expected object, received null","issues":[{"keyword":"inv... |
| MQTT_CONFIG_LIST | GET | `/api/v1/mqtt/configuration/configurations` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_CONFIG_VERSION_GET | GET | `/api/v1/mqtt/configuration/configurations/:versionId` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_CONFIG_VERSION_DIFF | GET | `/api/v1/mqtt/configuration/configurations/:versionId/diff` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_CONFIG_VERSION_DELETE | DELETE | `/api/v1/mqtt/configuration/configurations/:versionId` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_CONFIG_VERSION_APPLY | POST | `/api/v1/mqtt/configuration/configurations/:versionId/apply` | 403 | EXISTS_GATED | {"error":"FORBIDDEN","message":"Operational actions and machine actuation are strictly forbidden from remote tunnel i... |
| MQTT_CONFIG_VERSION_ROLLBACK | POST | `/api/v1/mqtt/configuration/configurations/:versionId/rollback` | 403 | EXISTS_GATED | {"error":"FORBIDDEN","message":"Operational actions and machine actuation are strictly forbidden from remote tunnel i... |
| MQTT_CONFIG_OPERATIONS | GET | `/api/v1/mqtt/configuration/operations` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_CONFIG_OPERATION_GET | GET | `/api/v1/mqtt/configuration/operations/:operationId` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| MQTT_CONFIG_BACKUPS | GET | `/api/v1/mqtt/configuration/backups` | 401 | EXISTS_GATED | {"error":"UNAUTHORIZED","message":"Authentication required. Please provide a valid Bearer token."} |
| DISC_DYNSEC_PROVISION | POST | `/api/v1/mqtt/dynamic-security/clients/provision` | 404 | MISSING | {"message":"Route POST:/api/v1/mqtt/dynamic-security/clients/provision not found","error":"Not Found","statusCode":404} |
| DISC_CONFIG_BACKUPS_POST | POST | `/api/v1/mqtt/configuration/backups` | 404 | MISSING | {"message":"Route POST:/api/v1/mqtt/configuration/backups not found","error":"Not Found","statusCode":404} |

## 3. Gap baru (N-1 – N-5)

Disilang dengan 14 gap SYS-B yang masih terbuka (B3, B6, B11, B12, B17, B23, B31–B37, B41) + R-1–R-23 — tidak ada duplikasi; semua di bawah ini BARU.

### N-1 — PATCH `/mqtt/dynamic-security/clients/:name/enable` → 502 text/plain (High, backend)

- **Bukti live:** `PATCH /api/v1/mqtt/dynamic-security/clients/probe-000/enable` (tanpa body, tanpa auth) → `502`, body `text/plain` 16 byte: `error code: 502` — tanpa envelope JSON. Satu-satunya 5xx dari 144 probe.
- **Ekspektasi panel:** toggle enable/disable klien di DynamicSecurityPage (`PATCH` + `{enabled}`, E20) mengharapkan 200 atau envelope error JSON (`{error, message}`) yang bisa ditampilkan `reqJson`.
- **Anomali pembanding:** `DELETE /clients/:name` mencapai 401 (auth gate jalan); semua mutasi dynsec lain mencapai 400 (validasi) atau 401. Hanya enable yang tidak sampai ke auth maupun validasi — request lolos ke sesuatu (broker dynsec / gateway) yang gagal.
- **Dampak:** toggle enable/disable dari panel akan gagal dengan error yang tidak ter-parse (bukan pesan bersih). Perlu Fase 2 ber-auth (ADMIN + LAN) untuk membedakan: apakah 502 hanya di jalur tanpa-token, atau handler enable memang rusak.
- **Sisi perbaikan:** backend. Terkait R-12 (tabel error §2 tidak memuat 502 text/plain) dan R-20 (dynsec).

### N-2 — Default device panel `STM32-OEE-01` tidak ada di live; tampilan default 404 di Real mode (Medium, panel)

- **Bukti live:** `GET /api/v1/devices` hanya mengembalikan `STM32-OEE-SIM`. `GET /api/v1/telemetry/STM32-OEE-01` → 404 `DEVICE_NOT_FOUND`. ID `-01` (device/machine/product) semuanya 404; hanya varian `-SIM` yang ada.
- **Ekspektasi panel:** default hardcoded `STM32-OEE-01` di `src/features/analytics/TelemetryHistoryPage.tsx:37,61`, `src/features/monitoring/DowntimeEventsPage.tsx:49,54,60`, fallback `src/features/analytics/hooks/useOeeAnalytics.ts:59`.
- **Dampak:** buka Telemetry History pertama kali di Real mode → 404 `DEVICE_NOT_FOUND` (bukan data). OEE Analytics jatuh ke device yang tidak ada. Downtime terdegradasi lebih lunak (list active kosong, `GET /downtime-events/PROBE-000` → `[]` 200). Operator harus memilih `STM32-OEE-SIM` manual.
- **Sisi perbaikan:** panel (default diambil dari daftar live `GET /devices` / perangkat terikat pertama; default `-01` hanya untuk mode demo). Alternatif backend (seed ID kanonis `-01`) — tetapi backend memilih penamaan `-SIM`, jadi perbaikan panel yang robust.

### N-3 — Urutan gate auth-vs-validasi tidak konsisten pada mutasi (Low, backend)

- **Bukti live:** kebanyakan POST/PUT/PATCH tanpa body → 400 `VALIDATION_ERROR` (validasi jalan SEBELUM auth, tanpa token pun sampai ke validator). Tetapi `IAM_POLICIES_CREATE`/`IAM_POLICIES_UPDATE` → 401 (auth dulu); semua DELETE → 401; `MACHINES_BIND` → 400 sedangkan `MACHINES_UNBIND` → 401; dalam satu resource policies: CREATE/UPDATE 401, DELETE 400 (`params/id Invalid UUID`).
- **Dampak:** sebagian besar kosmetik. Dengan token kedaluwarsa + body tidak valid, panel menampilkan error validasi alih-alih memicu alur re-login 401. Penanganan error per endpoint menjadi tidak dapat diprediksi.
- **Sisi perbaikan:** backend (konsistensi urutan middleware).

### N-4 — Dua teks pesan 401 berbeda (Low, backend)

- **Bukti live:** `/auth/me` + `/system/access-mode` → `"Token validation failed: missing or invalid Bearer token"`; semua `/access-control/*` → `"Authentication required. Please provide a valid Bearer token"`. Dua auth guard berbeda, konsisten di dalam masing-masing grup.
- **Dampak:** kosmetik; panel menampilkan teks pesan server di beberapa tempat (mis. error login).
- **Sisi perbaikan:** backend.

### N-5 — Produk live tanpa `sku`/`isActive` (Low, backend + panel)

- **Bukti live:** 5 produk live tidak membawa field `sku` maupun `isActive` (shape check vs `mapProduct`).
- **Dampak:** panel menampilkan `productId` sebagai SKU dan semua produk sebagai aktif; produk nonaktif tidak terbedakan. Bukan crash — mapper toleran.
- **Sisi perbaikan:** backend (kelengkapan data); bila field ditambahkan, panel perlu membaca `sku`/`isActive` di mapper.

## 4. Regresi §27 (AUDIT.md §27, probe 15:08–15:10 WIB)

| Temuan §27 | Kini | Status |
|---|---|---|
| `GET /api/v1/devices` 500 | **200** (1 item: `STM32-OEE-SIM`, PROVISIONED, bound `CNC-MILLING-SIM`) | **TERPERBAIKI** |
| `GET /api/v1/work-orders` 500 | **200** (2 item: `WO-SIM-20260906-01/02`, snake_case keys) | **TERPERBAIKI** |
| `GET /health/detail` 403 tunnel | 403 `"Health detail is not available through remote tunnel ingress."` | Tetap (by design — enforcement server-side) |
| `GET /system/access-mode` 401 | 401 | Tetap |
| `GET /auth/me` 401 | 401 | Tetap |
| `GET /health` 200 | 200 (`status:"ok"`, `db_connected:true`; uptime kini ~979 dtk pada probe irisan A — backend di-restart sejak §27) | Tetap |
| `GET /api/v1/live-state` 200 publik | 200 (1 item `STM32-OEE-SIM`/`CNC-MILLING-SIM`, `UNCONFIGURED`, semua counter 0) | Tetap |
| `GET /api/v1/machines` 200 | 200 (1 item `CNC-MILLING-SIM`) | Tetap |
| `GET /api/v1/products` 200 | 200 (5 item) | Tetap |
| `GET /api/v1/operators` 401 | 401 | Tetap |
| Login kredensial salah 401 / body kosong 400 | Tidak diprobe ulang (aturan keras); bukti §27 berlaku | — |

**Tidak ada lagi 500 di irisan B; satu-satunya 5xx di seluruh sweep adalah N-1 (502 enable).**

## 5. Shape check — 9/9 endpoint publik KOMPATIBEL

Bukti lengkap: `~/workspace/tmp-phase1-shape.json` + body di `~/workspace/tmp-phase1-bodies/<KEY>.json`.

| Endpoint | Verdict | Catatan |
|---|---|---|
| `GET /health` | COMPATIBLE | Bentuk lean sesuai rancangan panel; `metrics` 4 field ada, semua 0 + `lastIngestedAt: null` → UI "Belum ada" |
| `GET /api/v1/live-state` (+ by-device) | COMPATIBLE | Persentase string `"0.00"` → `num()` koersi ke 0; `lastCycleTimeSec` string → `undefined`; `uptimeSeconds` + `freeHeapBytes` DITERIMA mapper |
| `GET /api/v1/machines` (+ by-id) | COMPATIBLE | `boundDevice.ipAddress`/`firmwareVersion`/`model` absen → null; `CNC-MILLING-SIM` lolos regex + Zod `MachineSchema` |
| `GET /api/v1/products` (+ by-id) | COMPATIBLE | `stdCycleTimeSec` string (`"10.00"`, `"8.50"`) → `num()`; tanpa Zod, tidak bisa throw |
| `GET /api/v1/devices` | COMPATIBLE | `STM32-OEE-SIM` lolos regex + `EdgeDeviceSchema`; `enrollmentState: PROVISIONED` dalam enum |
| `GET /api/v1/work-orders` | COMPATIBLE | Live sudah snake_case seperti harapan mapper |

Tidak ada field live yang tidak dikenal panel. Satu-satunya jalur throw (`mustParse` Zod di `mapMachine`/`mapDevice`) LULUS dengan data live. Semua skema Zod memakai `z.object()` default strip (field ekstra dibuang, bukan error).

**Catatan bentuk yang bukan gap:** list live = bare array (panel kirim `?envelope=true&limit=50`; live mengabaikan query envelope; `splitList()` menangani bare array). Data SIM sudah ~18–19 menit basi saat probe (`lastTelemetryAt 08:25:13Z`) → panel memproyeksikan device SIM sebagai OFFLINE (TTL 300 dtk) — perilaku benar, bukan mismatch. `sku`/`isActive` produk absen → N-5.

## 6. Yang terkonfirmasi benar (bukan gap)

- **Penghapusan E20 hidup:** `POST /mqtt/dynamic-security/clients/provision` → 404 kanonis Fastify; `POST /mqtt/configuration/backups` → 404 (api_docs: tidak disediakan).
- **Aktuasi HMI-only tergating tunnel:** `POST /devices/:id/command` (GET probe) → 403 `"Operational actions and machine actuation are strictly forbidden from remote tunnel ingress"` — rute ada, panel benar tidak memanggilnya (registry sengaja mengecualikan).
- **`POST /api/v1/auth/operator-pin`** tidak diprobe — api_docs menyatakan DIHAPUS → 404; panel memblokir client-side via `FORBIDDEN_ENDPOINT_PATTERNS`.
- **Gate tunnel apply/rollback:** `MQTT_CONFIG_VERSION_APPLY` + `ROLLBACK` → 403 tunnel (rute ada, gate bekerja sebelum validasi body).
- **OEE butuh query wajib:** `shift-summary`/`hourly`/`shift-timeline` tanpa `machine_id`/`device_id` → 400 (sesuai api_docs).
- **Audit feed live aktif:** `GET /api/v1/operational-events` → 200, 50 item; terbaru `SECURITY_REJECTION` dari `PERIMETER_GATEWAY` (penolakan tunnel tercatat).
- **Tidak ada telemetri mengalir:** `/health` metrics semua 0; reconciliation jobs 10 job, `lastSuccessfulFinish: null`.

## 7. Yang TIDAK bisa diperiksa tanpa auth (untuk Fase 2)

1. Seluruh bentuk respons GET tergating (telemetry history/hourly/aggregate + kontennya, nilai OEE, objek dynsec, model konfigurasi, baris audit IAM, operator, dsb.).
2. Bentuk JSON `MQTT_OVERVIEW` dan `MQTT_CONFIG_STATUS` (keduanya 401; bentuk status config memang tidak lengkap di api_docs — AUDIT §24.1).
3. Handshake WS `/ws/telemetry` (relay hidup — `ws_clients:1` di `/health` — tapi handshake butuh auth; origin validation close 4403 + rate limit belum teruji).
4. Alur login/refresh/change-password (dilewati aturan keras; §27 hanya membuktikan login 401/400 tanpa token).
5. Akar penyebab N-1 (502 enable): butuh token valid + ADMIN + LAN untuk membedakan handler rusak vs jalur tanpa-token.
6. Empat endpoint WO HMI-only (`dispatch`/`complete`/`validate-zone`/`initiate-from-zones`): probe GET inkonklusif (404 generik vs `WO_NOT_FOUND` — rute `/:wo_id` menelan nama); butuh probe POST tanpa body ber-auth.
7. `:id` numerik pada `DOWNTIME_REASON` + `OPERATIONAL_EVENTS_ACK` (400 `expected number` untuk id palsu string): **bukan gap** — mapper panel men-string-kan id numerik live (`mapOperationalEvent` → `String(id)`), jadi path `/operational-events/1070/ack` valid. Diverifikasi dari kode, bukan dari probe.
8. Mutasi apa pun (POST/PUT/PATCH/DELETE dengan body) + perilaku `mutations_allowed` dari kanal tunnel vs LAN + `GET /system/access-mode` ber-auth.

## 8. Hasil verifikasi panel-side (koordinator)

| Pemeriksaan | Hasil |
|---|---|
| `npm test` | **368/368 lulus, 0 gagal** |
| `npx tsc --noEmit` | **0 error** |
| `npm run build` | **OK** (hanya peringatan chunk-size yang sudah ada) |
| `npm run check:structure` | **0 FAIL**, 37 WARN (lunak), 0 pengecualian — 305 file |

## 9. Silang dengan gap lama (tidak ada duplikasi)

14 gap SYS-B terbuka (B3, B6, B11, B12, B17, B23, B31–B37, B41) + R-1–R-23: tidak satu pun dari N-1–N-5 tercakup di sana. Kedekatan yang dicatat, bukan duplikasi: N-1 terkait R-12 (tabel error §2 tidak memuat 502 text/plain) dan R-20 (dynsec); N-2 terkait pola seed/demo (bukan R-item); N-3/N-4 tidak tercakup R-item mana pun.

## 10. Scratch + bukti

- Matriks mentah: `~/workspace/tmp-phase1-sliceA.json` (26 baris), `tmp-phase1-sliceB.json` (53), `tmp-phase1-sliceC.json` (65), `tmp-phase1-shape.json` (9 endpoint, 116 field).
- Body 200 tersimpan: `~/workspace/tmp-phase1-bodies/<KEY>.json` (17 file: HEALTH, LIVE_STATE, LIVE_STATE_BY_DEVICE, DEVICES_LIST, MACHINES_LIST, MACHINES_GET, PRODUCTS_LIST, PRODUCTS_GET, WORK_ORDERS_LIST, DOWNTIME_ACTIVE, DOWNTIME_BY_DEVICE, OPERATIONAL_EVENTS_LIST, OPERATIONAL_EVENTS_BY_DEVICE, TELEMETRY_AGGREGATE, TELEMETRY_ROLLUP, RECONCILIATION_JOBS, QUALITY_REJECTS_GLOBAL).
- Registry lengkap: `~/workspace/tmp-phase1-registry.json` (137 operasi).

## 11. Koreksi parent — verifikasi ulang 2026-11-19 16:03 WIB (PENTING)

Koordinator menulis §1–§10 dari snapshot probe 15:41–16:00 WIB. Parent
memverifikasi ulang langsung ke API live pada 16:03 WIB dan menemukan
backend BERUBAH di tengah jalan — dua temuan di bawah ini terkoreksi.
Bukti: `GET /health` uptime 687 dtk pada 16:03 → backend di-restart lagi
~15:52 WIB (sebelumnya restart ~15:27 WIB, uptime 979 dtk pada probe A).
Backend sedang aktif di-deploy/di-seed saat sweep berjalan.

### N-1 — TIDAK terreproduksi (transien restart, bukan bug persisten)

- Ulangan persis (PATCH enable tanpa body, tanpa auth) pada 16:03 →
  **400 VALIDATION_ERROR** `{error, message, issues}` (bukan 502).
  Dengan body `{"enabled":false}` → **401** JSON. Tidak ada lagi 502.
- Penjelasan paling mungkin: probe koordinator mengenai jendela restart
  backend (~15:52 WIB); 502 `text/plain "error code: 502"` berbau respons
  gateway saat backend belum siap, bukan handler enable yang rusak.
- **Keputusan parent: N-1 TIDAK dijadikan issue Linear.** Tercatat di sini
  sebagai observasi transien. Bila Fase 2 (ber-auth) mereproduksi 502
  pada endpoint ini, buka kembali sebagai gap.

### N-2 — MOOT sebagai defect live (perangkat -01 kini ada + telemetri mengalir)

- Pada 16:03, `GET /api/v1/devices` mengembalikan **2 item**:
  `STM32-OEE-01` (bound `CNC-MILLING-01`, `createdAt 08:54:40Z` =
  15:54:40 WIB — DI TENGAH jendela sweep) + `STM32-OEE-SIM`.
  `GET /api/v1/machines` → 2 item (`CNC-MILLING-01` + `-SIM`).
  `GET /api/v1/work-orders` → 3 item (baru: `WO-001`,
  CNC-MILLING-01, operator ADM-001 "Admin OEE", PENDING).
- `GET /api/v1/telemetry/STM32-OEE-01` → **200**, deret waktu nyata
  08:04–08:54Z (totalCount 150→199, RUNNING, OEE 92.80, A 95.50,
  P 98.20, Q 99.10, reject 5). **Telemetri mengalir untuk -01.**
  (Catatan: `/health` metrics masih 0 — counter in-memory yang
  ter-reset oleh restart 15:52 WIB, sementara baris telemetri di DB
  mencakup 15:04–15:54 WIB. Bukan kontradiksi.)
- **Keputusan parent: N-2 turun dari Medium menjadi Low** dan isinya
  berubah: bukan lagi "device default 404 di live", melainkan
  hardening panel — default device sebaiknya diambil dari daftar live
  (`GET /devices` / perangkat terikat pertama), bukan hardcoded
  `STM32-OEE-01`, supaya panel tidak 404 bila seed berubah.
  Bukti probe koordinator tetap akurat pada jamnya (sebelum 15:54 WIB
  hanya ada -SIM).

### Yang tetap berlaku

- N-3, N-4, N-5: tidak terbantahkan oleh verifikasi ulang; tetap gap baru.
- Registry 137/137 ada; /devices + /work-orders 500 → 200 (TERPERBAIKI,
  kini dengan data -01 pula); shape 9/9 kompatibel; suite panel 368/368.
- Commit SHA koreksi: dokumen ini ter-commit sebagai `8466d02`
  (bukan `8466d9c` seperti disebut di laporan koordinator).
