# Audit Cakupan Endpoint vs api_docs LIVE (OpenAPI) — Fase 2a

| | |
|---|---|
| **Tanggal** | 2026-11-19 (spec diunduh 16:16 WIB; probe 16:18–16:35 WIB) |
| **Spec sumber kebenaran** | `~/workspace/oee-live-openapi.json` — diunduh dari `https://oee.fadik.web.id/docs/openapi.json`; OpenAPI 3.0.3, "IIoT OEE Backend API" v1.0.0, 104 paths, 141 operasi. Catatan: file ini berupa **dump Zod mentah** (`def`/`shape`/`innerType`), bukan OpenAPI kanonis — worker menulis normalizer untuk mengurainya. Spec **tidak punya operationId** (0/141); kunci operasi = method+path. |
| **Panel** | Real mode, deploy Vercel `https://iiot-oee-admin-panel.vercel.app` (env terverifikasi dari bundle: `VITE_API_MODE=real`, API + WS `oee.fadik.web.id`) |
| **Registry panel** | 137 operasi (`src/services/api/endpoints.ts` + 12 file domain) |
| **Metode** | 5 worker paralel (parse+diff registry, contract diff 2 grup domain, probe live 138 operasi, cek statis fitur panel) + rekonsiliasi + verifikasi spot koordinator langsung terhadap spec. Tanpa auth (tidak ada token di fase ini); probe tulis tanpa body; login tidak diprobe (bukti §27 berlaku); tanpa ubah kode, tanpa push, tanpa sentuhan Linear |

## 1. Ringkasan eksekutif

- **Cakupan: LENGKAP.** 141 operasi spec vs 137 registry: 141 − 5 excluded-by-design = 136 HTTP + 1 WS = 137. **MISSING = 0, registry HTTP usang = 0.** Satu-satunya ketidakcocokan path: trailing slash `MQTT_CONFIG_GET` (N-39).
- **Kontrak (unik, 141 operasi): 67 OK / 55 MISMATCH / 19 KNOWN.** Severity mismatch: **14 BREAKS / 37 ERROR-PRONE / 4 COSMETIC**. (3 entri OK membawa catatan kosmetik.)
- **Gap baru: 35 (N-7–N-41)** — 7 High, 19 Medium, 9 Low — ditambah **N-6 Critical (CORS, diagnosis parent)**. Semua gap di bawah ini BARU (disilang vs N-2–N-5, 14 gap SYS-B terbuka, R-1–R-23; yang sudah dikenal ada di §7).
- **Probe live: 138 operasi, 0 rute hilang, 0 5xx.** 200×14, 401×58, 403×4, 400×52, 404×10. 121/138 cocok dengan spec; 17 anomali — semuanya endpoint Access Control yang spec-nya tidak mendeklarasikan respons error (N-40).
- **Blokir utama tetap N-6 (CORS):** tes panel via browser TERBLOKIR; seluruh verifikasi runtime halaman terautentikasi menunggu perbaikan backend. Semua temuan kontrak di dokumen ini bersifat statis (spec vs kode) kecuali yang ditandai terkonfirmasi probe.

## 2. N-6 — CORS origin panel Vercel tidak diizinkan (Critical, backend) — diagnosis parent, terverifikasi

> **N-6 (Critical, backend):** CORS origin tidak diizinkan untuk origin panel Vercel.
> Bukti parent 19 Nov 16:16 WIB: OPTIONS `/api/v1/auth/login` dengan `Origin: https://iiot-oee-admin-panel.vercel.app` → 403 `{"statusCode":403,"error":"Forbidden","message":"CORS origin not allowed: https://iiot-oee-admin-panel.vercel.app"}`; GET `/health` dengan Origin yang sama → 403 juga; OPTIONS tanpa Origin → 400 (middleware CORS aktif); OPTIONS Origin example.com → 403. Akibat: browser di panel Vercel TIDAK BISA melakukan request apa pun ke API (preflight gagal → panel menampilkan "Koneksi jaringan terputus atau backend tidak terjangkau" — terbukti oleh browser task 16:13–16:14 WIB, 2× submit login gagal dengan pesan itu, padahal host API terjangkau dari browser). Perbaikan: backend harus memasukkan origin Vercel ke allowlist CORS (dan mendokumentasikan allowlist-nya). Workaround sementara: tidak ada dari sisi panel — tes panel via browser TERBLOKIR sampai backend diperbaiki.

**Verifikasi koordinator (satu probe OPTIONS + satu GET, 19 Nov ~16:17 WIB):** OPTIONS `/api/v1/auth/login` + Origin Vercel → **403** `{"statusCode":403,"error":"Forbidden","message":"CORS origin not allowed: https://iiot-oee-admin-panel.vercel.app"}`; GET `/health` + Origin Vercel → **403** `{"error":"FORBIDDEN","message":"CORS origin not allowed: https://iiot-oee-admin-panel.vercel.app"}`. Bukti parent BENAR.

**Catatan metodologi (penting):** probe curl TANPA header Origin selalu lolos (CORS hanya ditegakkan browser) — jadi hasil probe curl di audit ini (worker D, §5) TIDAK membuktikan panel bisa mengakses endpoint itu dari browser. Sebaliknya, 4× 403 yang ditemukan worker D (tunnel-ingress enforcement, tanpa header Origin) adalah gating server-side yang BERBEDA dari CORS — jangan dikacaukan dengan N-6.

## 3. Rekonsiliasi spec ↔ registry

| | Jumlah |
|---|---|
| Operasi spec (104 paths) | **141** (GET 70, POST 38, DELETE 19, PATCH 8, PUT 6) |
| Operasi registry panel | **137** (GET 70, POST 33, DELETE 19, PATCH 8, PUT 6, WS 1) |
| Spec tidak di registry | 5 — semuanya excluded-by-design (lihat bawah) |
| Registry HTTP tidak di spec | **0** |
| Mismatch path/method | 1 (trailing slash, N-39) |

**Spec tidak di registry (5, semua excluded-by-design, MISSING = 0):**

| Method + path spec | Alasan |
|---|---|
| POST `/api/v1/devices/{device_id}/command` | Aktuasi mesin, ADR-003; `FORBIDDEN_ENDPOINT_PATTERNS` (`'/command'`, endpoints.ts:64) |
| POST `/api/v1/work-orders/{wo_id}/dispatch` | HMI-only; forbidden (endpoints.ts:65) |
| POST `/api/v1/work-orders/{wo_id}/complete` | HMI-only; forbidden (endpoints.ts:66) |
| POST `/api/v1/work-orders/validate-zone` | HMI-only; forbidden (endpoints.ts:67) |
| POST `/api/v1/work-orders/initiate-from-zones` | HMI-only; forbidden (endpoints.ts:68) |

**Registry tidak di spec:** hanya `WS_TELEMETRY` (WS `/ws/telemetry`, health.ts:27) — bukan usang; WebSocket memang tidak ada di OpenAPI paths, by design. Endpoint yang dihapus E20 sudah bersih dari registry (`POST /mqtt/dynamic-security/clients/provision`, `POST /mqtt/configuration/backups` — hanya disebut di `FORBIDDEN_ENDPOINT_PATTERNS`/komentar); yang tersisa `MQTT_CONFIG_BACKUPS` adalah **GET** dan ADA di spec. `POST /auth/operator-pin` tidak ada di registry maupun di spec.

**Kecocokan lain:** ke-75 pasangan berparameter punya nama parameter IDENTIK (beda notasi `:name` vs `{name}` saja); prefix `/api/v1` konsisten; kedua path root (`/health`, `/health/detail`) cocok persis; tidak ada path sama dengan method berbeda. **Catatan kosmetik (bukan gap):** komentar header `endpoints.ts` masih mengklaim "134 → 135" (E20 P20.5) — stale, tertinggal 2 dari hitungan aktual 137; perbaiki saat ada sentuhan berikutnya.

## 4. Matriks lengkap — operasi spec × registry × probe live × kontrak

Kolom Probe = status HTTP probe tanpa auth (worker D; tanpa header Origin — menguji backend, BUKAN akses browser). Kolom Kontrak = verdict diff spec vs panel (worker B/C, didedup: 2 operasi overlap diambil verdict C). Baris diurutkan sesuai urutan spec (`tmp-spec-ops.json`).

| # | Method | Path (spec) | Registry | Probe live | Kontrak |
|---:|---|---|---|---|---|
| 1 | GET | `/health` | HEALTH | 200 EXISTS_PUBLIC | OK |
| 2 | GET | `/health/detail` | HEALTH_DETAIL | 403 EXISTS_GATED | MISMATCH (ERROR-PRONE) |
| 3 | POST | `/api/v1/auth/login` | AUTH_LOGIN | SKIPPED (login) | OK |
| 4 | POST | `/api/v1/auth/refresh` | AUTH_REFRESH | SKIPPED (login) | OK |
| 5 | POST | `/api/v1/auth/password/change` | AUTH_CHANGE_PASSWORD | SKIPPED (login) | OK |
| 6 | GET | `/api/v1/auth/me` | AUTH_ME | 401 EXISTS_GATED | KNOWN (COSMETIC) |
| 7 | GET | `/api/v1/operators` | OPERATORS_LIST | 401 EXISTS_GATED | OK |
| 8 | POST | `/api/v1/operators` | OPERATORS_CREATE | 400 EXISTS_VALIDATION | OK |
| 9 | PATCH | `/api/v1/operators/{id}/password` | OPERATORS_PASSWORD | 400 EXISTS_VALIDATION | OK |
| 10 | PATCH | `/api/v1/operators/{id}/status` | OPERATORS_STATUS | 400 EXISTS_VALIDATION | OK |
| 11 | GET | `/api/v1/operators/{id}` | OPERATORS_GET | 401 EXISTS_GATED | OK |
| 12 | PUT | `/api/v1/operators/{id}` | OPERATORS_UPDATE | 400 EXISTS_VALIDATION | OK |
| 13 | DELETE | `/api/v1/operators/{id}` | OPERATORS_DELETE | 401 EXISTS_GATED | OK |
| 14 | GET | `/api/v1/access-control/info` | IAM_INFO | 401 EXISTS_GATED | MISMATCH (COSMETIC) |
| 15 | GET | `/api/v1/access-control/roles` | IAM_ROLES_LIST | 401 EXISTS_GATED | OK |
| 16 | POST | `/api/v1/access-control/roles` | IAM_ROLES_CREATE | 400 EXISTS_VALIDATION | KNOWN (ERROR-PRONE) |
| 17 | PUT | `/api/v1/access-control/roles/{id}` | IAM_ROLES_UPDATE | 400 EXISTS_VALIDATION | KNOWN (ERROR-PRONE) |
| 18 | DELETE | `/api/v1/access-control/roles/{id}` | IAM_ROLES_DELETE | 400 EXISTS_VALIDATION | OK |
| 19 | POST | `/api/v1/access-control/roles/{id}/permissions` | IAM_ROLE_PERMISSIONS_ADD | 400 EXISTS_VALIDATION | OK |
| 20 | DELETE | `/api/v1/access-control/roles/{id}/permissions/{permissionId}` | IAM_ROLE_PERMISSIONS_DELETE | 400 EXISTS_VALIDATION | OK |
| 21 | GET | `/api/v1/access-control/permissions` | IAM_PERMISSIONS_LIST | 401 EXISTS_GATED | OK |
| 22 | POST | `/api/v1/access-control/permissions` | IAM_PERMISSIONS_CREATE | 400 EXISTS_VALIDATION | KNOWN (ERROR-PRONE) |
| 23 | GET | `/api/v1/access-control/user-roles` | IAM_USER_ROLES_LIST | 401 EXISTS_GATED | OK |
| 24 | POST | `/api/v1/access-control/user-roles` | IAM_USER_ROLES_CREATE | 400 EXISTS_VALIDATION | KNOWN (ERROR-PRONE) |
| 25 | DELETE | `/api/v1/access-control/user-roles` | IAM_USER_ROLES_DELETE | 400 EXISTS_VALIDATION | KNOWN (ERROR-PRONE) |
| 26 | GET | `/api/v1/access-control/policies` | IAM_POLICIES_LIST | 401 EXISTS_GATED | OK |
| 27 | POST | `/api/v1/access-control/policies` | IAM_POLICIES_CREATE | 401 EXISTS_GATED | OK |
| 28 | PUT | `/api/v1/access-control/policies/{id}` | IAM_POLICIES_UPDATE | 401 EXISTS_GATED | OK |
| 29 | DELETE | `/api/v1/access-control/policies/{id}` | IAM_POLICIES_DELETE | 400 EXISTS_VALIDATION | OK |
| 30 | GET | `/api/v1/access-control/subjects/{operatorId}/effective-permissions` | IAM_SUBJECT_EFFECTIVE_PERMISSIONS | 401 EXISTS_GATED | MISMATCH (BREAKS) |
| 31 | GET | `/api/v1/access-control/audit` | IAM_AUDIT | 401 EXISTS_GATED | KNOWN (ERROR-PRONE) |
| 32 | GET | `/api/v1/system/audit` | SYSTEM_AUDIT | 401 EXISTS_GATED | KNOWN (ERROR-PRONE) |
| 33 | GET | `/api/v1/system/audit/export` | SYSTEM_AUDIT_EXPORT | 401 EXISTS_GATED | MISMATCH (ERROR-PRONE) |
| 34 | GET | `/api/v1/system/access-mode` | SYSTEM_ACCESS_MODE | 401 EXISTS_GATED | OK |
| 35 | GET | `/api/v1/devices` | DEVICES_LIST | 200 EXISTS_PUBLIC | OK |
| 36 | POST | `/api/v1/devices` | DEVICES_CREATE | 400 EXISTS_VALIDATION | MISMATCH (COSMETIC) |
| 37 | GET | `/api/v1/devices/{deviceId}/health` | DEVICES_HEALTH | 404 OTHER | MISMATCH (ERROR-PRONE) |
| 38 | GET | `/api/v1/devices/{deviceId}` | DEVICES_GET | 404 OTHER | OK |
| 39 | PUT | `/api/v1/devices/{deviceId}` | DEVICES_UPDATE | 400 EXISTS_VALIDATION | MISMATCH (ERROR-PRONE) |
| 40 | DELETE | `/api/v1/devices/{deviceId}` | DEVICES_DELETE | 401 EXISTS_GATED | OK |
| 41 | POST | `/api/v1/devices/provision` | DEVICES_PROVISION | 400 EXISTS_VALIDATION | OK |
| 42 | POST | `/api/v1/devices/{deviceId}/revoke` | DEVICES_REVOKE | 400 EXISTS_VALIDATION | OK |
| 43 | POST | `/api/v1/devices/{deviceId}/credentials` | DEVICES_CREDENTIALS | 400 EXISTS_VALIDATION | OK |
| 44 | POST | `/api/v1/devices/{device_id}/command` | — (excluded by design) | 403 EXISTS_GATED | KNOWN (COSMETIC) |
| 45 | GET | `/api/v1/work-orders` | WORK_ORDERS_LIST | 200 EXISTS_PUBLIC | MISMATCH (ERROR-PRONE) |
| 46 | GET | `/api/v1/work-orders/{wo_id}/resolve` | WORK_ORDERS_RESOLVE | 400 EXISTS_VALIDATION | MISMATCH (COSMETIC) |
| 47 | POST | `/api/v1/work-orders/{wo_id}/dispatch` | — (excluded by design) | 400 EXISTS_VALIDATION | KNOWN (COSMETIC) |
| 48 | POST | `/api/v1/work-orders/validate-zone` | — (excluded by design) | 400 EXISTS_VALIDATION | KNOWN (COSMETIC) |
| 49 | POST | `/api/v1/work-orders/initiate-from-zones` | — (excluded by design) | 400 EXISTS_VALIDATION | KNOWN (COSMETIC) |
| 50 | POST | `/api/v1/work-orders/{wo_id}/complete` | — (excluded by design) | 400 EXISTS_VALIDATION | KNOWN (COSMETIC) |
| 51 | GET | `/api/v1/work-orders/{wo_id}` | WORK_ORDERS_GET | 404 OTHER | OK |
| 52 | POST | `/api/v1/work-orders/{wo_id}/cancel` | WORK_ORDERS_CANCEL | 400 EXISTS_VALIDATION | MISMATCH (COSMETIC) |
| 53 | GET | `/api/v1/downtime-events/active` | DOWNTIME_ACTIVE | 200 EXISTS_PUBLIC | MISMATCH (ERROR-PRONE) |
| 54 | GET | `/api/v1/downtime-events/{device_id}/export` | DOWNTIME_DEVICE_EXPORT | 401 EXISTS_GATED | MISMATCH (ERROR-PRONE) |
| 55 | GET | `/api/v1/downtime-events/{device_id}` | DOWNTIME_BY_DEVICE | 200 EXISTS_PUBLIC | MISMATCH (ERROR-PRONE) |
| 56 | POST | `/api/v1/downtime-events/{id}/reason` | DOWNTIME_REASON | 400 EXISTS_VALIDATION | MISMATCH (ERROR-PRONE) |
| 57 | GET | `/api/v1/operational-events` | OPERATIONAL_EVENTS_LIST | 200 EXISTS_PUBLIC | KNOWN (ERROR-PRONE) |
| 58 | GET | `/api/v1/operational-events/export` | OPERATIONAL_EVENTS_EXPORT | 401 EXISTS_GATED | MISMATCH (ERROR-PRONE) |
| 59 | PATCH | `/api/v1/operational-events/{id}/ack` | OPERATIONAL_EVENTS_ACK | 400 EXISTS_VALIDATION | OK |
| 60 | GET | `/api/v1/operational-events/{deviceId}` | OPERATIONAL_EVENTS_BY_DEVICE | 200 EXISTS_PUBLIC | KNOWN (ERROR-PRONE) |
| 61 | GET | `/api/v1/operational-events/{deviceId}/export` | OPERATIONAL_EVENTS_DEVICE_EXPORT | 401 EXISTS_GATED | MISMATCH (ERROR-PRONE) |
| 62 | GET | `/api/v1/telemetry/reconciliation/jobs` | RECONCILIATION_JOBS | 200 EXISTS_PUBLIC | MISMATCH (ERROR-PRONE) |
| 63 | POST | `/api/v1/telemetry/reconciliation/refresh` | RECONCILIATION_REFRESH | 400 EXISTS_VALIDATION | MISMATCH (BREAKS) |
| 64 | GET | `/api/v1/telemetry/{device_id}/export` | TELEMETRY_EXPORT | 401 EXISTS_GATED | MISMATCH (ERROR-PRONE) |
| 65 | GET | `/api/v1/telemetry/{device_id}/hourly/export` | TELEMETRY_HOURLY_EXPORT | 401 EXISTS_GATED | MISMATCH (ERROR-PRONE) |
| 66 | GET | `/api/v1/telemetry/rollup` | TELEMETRY_ROLLUP | 200 EXISTS_PUBLIC | MISMATCH (ERROR-PRONE) |
| 67 | GET | `/api/v1/telemetry/{device_id}/aggregate` | TELEMETRY_AGGREGATE | 200 EXISTS_PUBLIC | MISMATCH (BREAKS) |
| 68 | GET | `/api/v1/telemetry/{device_id}/hourly` | TELEMETRY_HOURLY | 404 OTHER | MISMATCH (ERROR-PRONE) |
| 69 | GET | `/api/v1/telemetry/{device_id}` | TELEMETRY_HISTORY | 404 OTHER | MISMATCH (ERROR-PRONE) |
| 70 | GET | `/api/v1/oee/shift-summary` | OEE_SHIFT_SUMMARY | 400 EXISTS_VALIDATION | MISMATCH (ERROR-PRONE) |
| 71 | GET | `/api/v1/oee/hourly` | OEE_HOURLY | 400 EXISTS_VALIDATION | MISMATCH (ERROR-PRONE) |
| 72 | GET | `/api/v1/oee/shift-timeline` | OEE_SHIFT_TIMELINE | 400 EXISTS_VALIDATION | OK (COSMETIC) |
| 73 | GET | `/api/v1/quality/rejects` | QUALITY_REJECTS_GLOBAL | 200 EXISTS_PUBLIC | MISMATCH (ERROR-PRONE) |
| 74 | GET | `/api/v1/quality/rejects/{device_id}` | QUALITY_REJECTS_BY_DEVICE | 404 OTHER | MISMATCH (ERROR-PRONE) |
| 75 | GET | `/api/v1/live-state` | LIVE_STATE | 200 EXISTS_PUBLIC | OK |
| 76 | GET | `/api/v1/live-state/{deviceId}` | LIVE_STATE_BY_DEVICE | 404 OTHER | OK |
| 77 | GET | `/api/v1/machines` | MACHINES_LIST | 200 EXISTS_PUBLIC | OK |
| 78 | POST | `/api/v1/machines` | MACHINES_CREATE | 400 EXISTS_VALIDATION | MISMATCH (ERROR-PRONE) |
| 79 | GET | `/api/v1/machines/{machineId}` | MACHINES_GET | 404 OTHER | OK |
| 80 | PUT | `/api/v1/machines/{machineId}` | MACHINES_UPDATE | 400 EXISTS_VALIDATION | MISMATCH (ERROR-PRONE) |
| 81 | DELETE | `/api/v1/machines/{machineId}` | MACHINES_DELETE | 401 EXISTS_GATED | OK |
| 82 | POST | `/api/v1/machines/{machineId}/bind` | MACHINES_BIND | 400 EXISTS_VALIDATION | OK |
| 83 | POST | `/api/v1/machines/{machineId}/unbind` | MACHINES_UNBIND | 401 EXISTS_GATED | OK |
| 84 | GET | `/api/v1/machines/{machineId}/status-history` | MACHINES_STATUS_HISTORY | 404 OTHER | OK |
| 85 | GET | `/api/v1/production-lines` | PRODUCTION_LINES_LIST | 401 EXISTS_GATED | OK |
| 86 | POST | `/api/v1/production-lines` | PRODUCTION_LINES_CREATE | 400 EXISTS_VALIDATION | OK |
| 87 | GET | `/api/v1/production-lines/{lineId}` | PRODUCTION_LINES_GET | 401 EXISTS_GATED | OK |
| 88 | PATCH | `/api/v1/production-lines/{lineId}` | PRODUCTION_LINES_UPDATE | 400 EXISTS_VALIDATION | OK |
| 89 | DELETE | `/api/v1/production-lines/{lineId}` | PRODUCTION_LINES_DELETE | 401 EXISTS_GATED | OK |
| 90 | GET | `/api/v1/products` | PRODUCTS_LIST | 200 EXISTS_PUBLIC | KNOWN (COSMETIC) |
| 91 | POST | `/api/v1/products` | PRODUCTS_CREATE | 400 EXISTS_VALIDATION | KNOWN (COSMETIC) |
| 92 | GET | `/api/v1/products/{productId}` | PRODUCTS_GET | 404 OTHER | KNOWN (COSMETIC) |
| 93 | PUT | `/api/v1/products/{productId}` | PRODUCTS_UPDATE | 400 EXISTS_VALIDATION | KNOWN (COSMETIC) |
| 94 | DELETE | `/api/v1/products/{productId}` | PRODUCTS_DELETE | 401 EXISTS_GATED | OK |
| 95 | GET | `/api/v1/shifts` | SHIFTS_LIST | 401 EXISTS_GATED | MISMATCH (ERROR-PRONE) |
| 96 | POST | `/api/v1/shifts` | SHIFTS_CREATE | 400 EXISTS_VALIDATION | MISMATCH (ERROR-PRONE) |
| 97 | GET | `/api/v1/shifts/{shiftId}` | SHIFTS_GET | 401 EXISTS_GATED | MISMATCH (ERROR-PRONE) |
| 98 | PATCH | `/api/v1/shifts/{shiftId}` | SHIFTS_UPDATE | 400 EXISTS_VALIDATION | MISMATCH (ERROR-PRONE) |
| 99 | DELETE | `/api/v1/shifts/{shiftId}` | SHIFTS_DELETE | 401 EXISTS_GATED | OK |
| 100 | GET | `/api/v1/shift-schedules` | SHIFT_SCHEDULES_LIST | 401 EXISTS_GATED | MISMATCH (ERROR-PRONE) |
| 101 | POST | `/api/v1/shift-schedules` | SHIFT_SCHEDULES_CREATE | 400 EXISTS_VALIDATION | MISMATCH (ERROR-PRONE) |
| 102 | GET | `/api/v1/shift-schedules/{scheduleId}` | SHIFT_SCHEDULES_GET | 401 EXISTS_GATED | MISMATCH (ERROR-PRONE) |
| 103 | PATCH | `/api/v1/shift-schedules/{scheduleId}` | SHIFT_SCHEDULES_UPDATE | 400 EXISTS_VALIDATION | MISMATCH (ERROR-PRONE) |
| 104 | DELETE | `/api/v1/shift-schedules/{scheduleId}` | SHIFT_SCHEDULES_DELETE | 401 EXISTS_GATED | OK |
| 105 | GET | `/api/v1/mqtt/dynamic-security/status` | MQTT_DYNSEC_STATUS | 401 EXISTS_GATED | MISMATCH (BREAKS) |
| 106 | GET | `/api/v1/mqtt/dynamic-security/clients` | MQTT_DYNSEC_CLIENTS_LIST | 401 EXISTS_GATED | OK |
| 107 | POST | `/api/v1/mqtt/dynamic-security/clients` | MQTT_DYNSEC_CLIENTS_CREATE | 400 EXISTS_VALIDATION | OK |
| 108 | GET | `/api/v1/mqtt/dynamic-security/clients/{name}` | MQTT_DYNSEC_CLIENTS_GET | 401 EXISTS_GATED | OK |
| 109 | DELETE | `/api/v1/mqtt/dynamic-security/clients/{name}` | MQTT_DYNSEC_CLIENTS_DELETE | 401 EXISTS_GATED | OK |
| 110 | PATCH | `/api/v1/mqtt/dynamic-security/clients/{name}/password` | MQTT_DYNSEC_CLIENTS_PASSWORD | 400 EXISTS_VALIDATION | OK |
| 111 | PATCH | `/api/v1/mqtt/dynamic-security/clients/{name}/enable` | MQTT_DYNSEC_CLIENTS_ENABLE | 400 EXISTS_VALIDATION | MISMATCH (BREAKS) |
| 112 | POST | `/api/v1/mqtt/dynamic-security/clients/{name}/roles` | MQTT_DYNSEC_CLIENT_ROLES_ADD | 400 EXISTS_VALIDATION | MISMATCH (BREAKS) |
| 113 | DELETE | `/api/v1/mqtt/dynamic-security/clients/{name}/roles/{rolename}` | MQTT_DYNSEC_CLIENT_ROLES_DELETE | 401 EXISTS_GATED | OK |
| 114 | GET | `/api/v1/mqtt/dynamic-security/roles` | MQTT_DYNSEC_ROLES_LIST | 401 EXISTS_GATED | OK |
| 115 | POST | `/api/v1/mqtt/dynamic-security/roles` | MQTT_DYNSEC_ROLES_CREATE | 400 EXISTS_VALIDATION | MISMATCH (BREAKS) |
| 116 | GET | `/api/v1/mqtt/dynamic-security/roles/{name}` | MQTT_DYNSEC_ROLES_GET | 401 EXISTS_GATED | OK |
| 117 | DELETE | `/api/v1/mqtt/dynamic-security/roles/{name}` | MQTT_DYNSEC_ROLES_DELETE | 401 EXISTS_GATED | OK |
| 118 | POST | `/api/v1/mqtt/dynamic-security/roles/{name}/acls` | MQTT_DYNSEC_ROLE_ACLS_ADD | 400 EXISTS_VALIDATION | MISMATCH (BREAKS) |
| 119 | DELETE | `/api/v1/mqtt/dynamic-security/roles/{name}/acls` | MQTT_DYNSEC_ROLE_ACLS_DELETE | 400 EXISTS_VALIDATION | OK |
| 120 | GET | `/api/v1/mqtt/dynamic-security/groups` | MQTT_DYNSEC_GROUPS_LIST | 401 EXISTS_GATED | OK |
| 121 | POST | `/api/v1/mqtt/dynamic-security/groups` | MQTT_DYNSEC_GROUPS_CREATE | 400 EXISTS_VALIDATION | MISMATCH (BREAKS) |
| 122 | GET | `/api/v1/mqtt/dynamic-security/groups/{name}` | MQTT_DYNSEC_GROUPS_GET | 401 EXISTS_GATED | OK |
| 123 | DELETE | `/api/v1/mqtt/dynamic-security/groups/{name}` | MQTT_DYNSEC_GROUPS_DELETE | 401 EXISTS_GATED | OK |
| 124 | POST | `/api/v1/mqtt/dynamic-security/groups/{name}/clients` | MQTT_DYNSEC_GROUP_CLIENTS_ADD | 400 EXISTS_VALIDATION | MISMATCH (BREAKS) |
| 125 | DELETE | `/api/v1/mqtt/dynamic-security/groups/{name}/clients/{username}` | MQTT_DYNSEC_GROUP_CLIENTS_DELETE | 401 EXISTS_GATED | OK |
| 126 | POST | `/api/v1/mqtt/dynamic-security/groups/{name}/roles` | MQTT_DYNSEC_GROUP_ROLES_ADD | 400 EXISTS_VALIDATION | MISMATCH (BREAKS) |
| 127 | DELETE | `/api/v1/mqtt/dynamic-security/groups/{name}/roles/{rolename}` | MQTT_DYNSEC_GROUP_ROLES_DELETE | 401 EXISTS_GATED | OK |
| 128 | GET | `/api/v1/mqtt/overview` | MQTT_OVERVIEW | 401 EXISTS_GATED | MISMATCH (ERROR-PRONE) |
| 129 | GET | `/api/v1/mqtt/configuration` | — | 401 EXISTS_GATED | MISMATCH (ERROR-PRONE) |
| 130 | GET | `/api/v1/mqtt/configuration/raw` | MQTT_CONFIG_RAW | 401 EXISTS_GATED | MISMATCH (ERROR-PRONE) |
| 131 | GET | `/api/v1/mqtt/configuration/status` | MQTT_CONFIG_STATUS | 401 EXISTS_GATED | MISMATCH (BREAKS) |
| 132 | POST | `/api/v1/mqtt/configuration/configurations` | MQTT_CONFIG_STAGE | 400 EXISTS_VALIDATION | MISMATCH (BREAKS) |
| 133 | GET | `/api/v1/mqtt/configuration/configurations` | MQTT_CONFIG_LIST | 401 EXISTS_GATED | OK (COSMETIC) |
| 134 | GET | `/api/v1/mqtt/configuration/configurations/{versionId}` | MQTT_CONFIG_VERSION_GET | 401 EXISTS_GATED | MISMATCH (ERROR-PRONE) |
| 135 | DELETE | `/api/v1/mqtt/configuration/configurations/{versionId}` | MQTT_CONFIG_VERSION_DELETE | 401 EXISTS_GATED | OK |
| 136 | GET | `/api/v1/mqtt/configuration/configurations/{versionId}/diff` | MQTT_CONFIG_VERSION_DIFF | 401 EXISTS_GATED | MISMATCH (BREAKS) |
| 137 | POST | `/api/v1/mqtt/configuration/configurations/{versionId}/apply` | MQTT_CONFIG_VERSION_APPLY | 403 EXISTS_GATED | OK |
| 138 | POST | `/api/v1/mqtt/configuration/configurations/{versionId}/rollback` | MQTT_CONFIG_VERSION_ROLLBACK | 403 EXISTS_GATED | OK |
| 139 | GET | `/api/v1/mqtt/configuration/operations` | MQTT_CONFIG_OPERATIONS | 401 EXISTS_GATED | MISMATCH (ERROR-PRONE) |
| 140 | GET | `/api/v1/mqtt/configuration/operations/{operationId}` | MQTT_CONFIG_OPERATION_GET | 401 EXISTS_GATED | MISMATCH (ERROR-PRONE) |
| 141 | GET | `/api/v1/mqtt/configuration/backups` | MQTT_CONFIG_BACKUPS | 401 EXISTS_GATED | OK (COSMETIC) |

## 5. Temuan probe live (worker D — 138 operasi, tanpa auth, tanpa Origin)

| Status | Jumlah | Arti |
|---|---|---|
| 200 | 14 | Publik, data seed nyata |
| 401 UNAUTHORIZED | 58 | Rute ada + tergating |
| 403 FORBIDDEN | 4 | Tunnel-ingress enforcement (BUKAN CORS — probe tanpa Origin) |
| 400 VALIDATION_ERROR | 52 | Rute ada; validasi jalan sebelum auth |
| 404 | 10 | Semua resource-not-found bernama, rute ADA |
| 5xx | **0** | Tidak ada — 502 N-1 tidak muncul lagi |
| Dilewati | 3 | Login/refresh/change-password (aturan keras; bukti §27 berlaku) |

Verdict: EXISTS_PUBLIC 14, EXISTS_GATED 62 (401/403), EXISTS_VALIDATION 52 (400), OTHER 10 (resource-404), **MISSING_404 ×0**. **121/138 operasi cocok dengan spec** (status live ada dalam daftar responses spec).

**Anomali vs spec (17, satu kelompok — N-40):** semua endpoint Access Control yang di spec hanya mendeklarasikan `200` (atau `201` untuk POST policies), tetapi live mengembalikan 401 (auth gate tak terdokumentasi: GET roles/permissions/user-roles/policies, POST policies, PUT policies, GET effective-permissions, GET audit) atau 400 (validasi schema sebelum auth: POST/PUT/DELETE roles, POST/DELETE roles-permissions, POST/DELETE user-roles, DELETE policies — bukti `params/id Invalid UUID` / `body/ Invalid input: expected object, received null`).

**Temuan lain:**
- **10× 404 = resource-not-found, bukan rute hilang** — `DEVICE_NOT_FOUND`, `WO_NOT_FOUND`, `MACHINE_NOT_FOUND`, `PRODUCT_NOT_FOUND`, live-state ("Live state for device PROBE-000 not found"). Semua expected untuk ID probe.
- **OEE (3 endpoint):** tanpa query → 400 `machine_id or device_id is required` (sesuai spec); retry sekali `device_id=STM32-OEE-SIM` → **200 ketiganya** (shift-summary OEE 0, hourly `[]`, shift-timeline bucket `UNCONFIGURED`).
- **14 operasi publik (200):** `/health`, devices, work-orders, live-state, machines, products, downtime-events active + per-device, operational-events list + per-device, telemetry rollup, telemetry aggregate, reconciliation/jobs, quality/rejects — semuanya data seed nyata.
- **Pola 400-pada-tulis:** 52 operasi tulis mengembalikan 400 sebelum auth (body null / param bukan UUID). Keberadaan rute terbukti, tetapi **gating auth tidak terbukti** oleh probe ini untuk rute-rute tersebut (validasi schema jalan duluan).
- **4× 403 tunnel (BUKAN CORS):** `GET /health/detail` ("Health detail is not available through remote tunnel ingress."); `POST /devices/{id}/command`, `POST /mqtt/configuration/configurations/{versionId}/apply|rollback` ("Operational actions and machine actuation are strictly forbidden from remote tunnel ingress.").
- **Inkonsistensi not-found (N-41):** `GET /telemetry/{device_id}/aggregate` dan `GET /downtime-events/{device_id}` mengembalikan `[]` (200) untuk device probe yang tidak ada, sementara history/hourly/quality-rejects mengembalikan 404 `DEVICE_NOT_FOUND` untuk ID yang sama.
- **Backend di-restart lagi:** `/health` uptime ~56 dtk saat probe (~16:19 WIB) — restart ketiga hari ini (sebelumnya ~15:27 dan ~15:52 WIB). `db_connected: true`, `ws_clients: 0`.

## 6. Gap baru N-7–N-41 (35 gap: 7 High, 19 Medium, 9 Low)

Pengelompokan berdasarkan akar penyebab; satu gap dapat mencakup beberapa operasi. Severity mengikuti worker (BREAKS→High, ERROR-PRONE→Medium, COSMETIC→Low) kecuali dua penurunan yang dinyatakan alasannya (N-32, N-33). Sisi perbaikan: panel kecuali dinyatakan backend.

### 6.1 High (7)

**N-7 — Inspector effective-permissions: `roles` string[] dibaca sebagai objek (BREAKS, panel).**
Spec `GET /api/v1/access-control/subjects/{operatorId}/effective-permissions`: `roles` adalah `string[]` (mis. `["ADMIN","OPERATOR"]`); objek `{roleName, roleId, scopeType, scopeId}` hidup di `assignments[]`, bukan di `roles[]`. Panel `mapIamSubjectEffectivePermissions` memperlakukan tiap elemen `roles` sebagai objek — `pick(roleName)` dari string = `undefined` → `roleName=''`. `InspectorTab.tsx:80` merender badge `{er.roleName} ({er.scopeType})` → badge peran kosong di Real mode. Bukti: spec diverifikasi koordinator langsung (field `roles` = array-of-string); panel `mappers/system.ts:281`, `src/types/iam.ts`. Terkait B12/R-21 (endpoint sama) — TETAPI aspek ini baru: B12 yang tercatat hanya soal kode 404 + perilaku tanpa-assignment, bukan tipe elemen `roles`. Perbaikan: panel (baca `roles` sebagai string; detail peran dari `assignments[]`).

**N-8 — Reconciliation refresh: body `{from,to}` vs spec `{startWindow,endWindow}` (BREAKS, panel).**
Spec `POST /api/v1/telemetry/reconciliation/refresh`: body wajib `{startWindow?, endWindow?}` (datetime; field opsional, body wajib) — diverifikasi koordinator dari spec. Panel mengirim `{from?, to?}` (dihilangkan bila kosong) → kunci panel tidak dikenal spec. Keputusan E20 R11/T9/X29 (`{from,to}` mengikuti api_docs §K.6) **dibalikkan** oleh spec live ini. Perilaku live pastinya (400 vs jendela default yang salah) BELUM terverifikasi — butuh probe ber-auth. Panel: `http/telemetry.ts:90`. Perbaikan: panel (kirim `startWindow`/`endWindow`); bila server 400 untuk kunci tak dikenal, itulah buktinya.

**N-9 — 7 sub-op DynSec mengembalikan `{success}` saja; panel memetakan sebagai objek penuh (BREAKS, panel).**
Operasi: PATCH `…/clients/{name}/enable`, POST `…/clients/{name}/roles`, POST `…/groups`, POST `…/groups/{name}/clients`, POST `…/groups/{name}/roles`, POST `…/roles`, POST `…/roles/{name}/acls` — spec 200/201 hanya `{success}` (diverifikasi koordinator untuk enable). Panel `mapMqttClient/Role/Group` menghasilkan username/groupname/rolename `''` → hasil mutasi tampil sebagai entitas kosong. Body request-nya cocok. Panel: `http/mqttDynsec.ts:122,140,281,318,350,191,229`. Perbaikan: panel (perlakukan respons sebagai ack; refresh list sesudahnya).

**N-10 — MQTT config status: bentuk spec bertentangan total dengan mapper panel (BREAKS, panel).**
Spec `GET /mqtt/configuration/status` AKHIRNYA mendefinisikan bentuk ini (menjawab AUDIT §24.1): `{runtime:{mode, available, validation, reload, restart, apply, …}, lock:{held, stale, …}, current:{…}|null, lastOperation:{…}|null, lastAppliedVersionId}` — diverifikasi koordinator dari spec. Mapper panel membaca field top-level `status/activeVersionId/lastAppliedAt/mutationLocked/lastOperation(string)/measuredAt` — tak satu pun ada → status selalu `'UNAVAILABLE'`. Dipakai UI live (`useBrokerConfig.ts:69`). Panel: `http/mqttConfig.ts:104`, `types/mqtt.ts:BrokerConfigStatus`. Perbaikan: panel (tulis ulang mapper + tipe ke bentuk spec).

**N-11 — Telemetry aggregate: delta vs count — `total_parts` selalu 0 (BREAKS, panel).**
Spec `GET /api/v1/telemetry/{device_id}/aggregate`: item membawa `outputDelta/rejectDelta/goodDelta`, TANPA `totalCount/goodCount/rejectCount` (diverifikasi koordinator; `sampleCount` ada). Mapper menurunkan ketiganya = 0 → `getTelemetryAggregate` total_parts selalu 0 (rata-rata *Pct dan sample_count tetap benar). Panel: `mappers/monitoring.ts:243`, `http/monitoring.ts:247`, `schemas/dto.ts:440`. Perbaikan: panel (turunkan count dari delta, atau tampilkan delta apa adanya).

**N-12 — Config stage: bridges butuh password + `validation/impact/diff` dibuang (BREAKS, panel).**
Spec `POST /mqtt/configuration/configurations`: body stage memuat `bridges[]` dengan `password` + `remote_address` (wajib); panel me-round-trip bridges hasil GET (tipe `BrokerBridge` tak punya `password`; `remote_address` nullable) → staging config ber-bridge → 400/422. Plus 201 menyertakan `validation{status, issues, isolated}/impact/diff` — panel membuang ketiganya (tak ada field di `BrokerConfigVersion`) sehingga validasi gagal tak terlihat. `GET /configurations/{versionId}` juga membuang ketiganya. Panel: `http/mqttConfig.ts:130,155`, `types/mqtt.ts:BrokerBridge`. Perbaikan: panel (minta password bridge saat staging; simpan + tampilkan validation/impact/diff).

**N-13 — Config diff: `lines[]` diabaikan — tampilan diff selalu kosong (BREAKS, panel).**
Spec `GET /mqtt/configuration/configurations/{versionId}/diff`: `{baseVersionId, versionId, baseChecksum, checksum, truncated, lines:[{type: context|add|remove, oldLine, newLine, text}]}` (diverifikasi koordinator). Panel membaca `diff_summary/changed_keys` (tak ada di spec) dan mengabaikan `lines[]` sepenuhnya → diff selalu kosong. Panel: `http/mqttConfig.ts:164`. Perbaikan: panel (render `lines[]`).

### 6.2 Medium (19)

**N-14 — Machines: `lineId` tidak pernah dikirim (panel).**
Spec POST/PUT `/machines` menerima `lineId?` (create default server `LINE-01`; update bisa pindah lini — diverifikasi koordinator). Panel `createMachine`/`updateMachine` tidak pernah mengirimnya; `CreateMachineInput`/`UpdateMachineInput` tidak punya input lini → mesin baru selalu `LINE-01`, lini tak bisa diubah via panel. Panel: `http/machines.ts:84,115`, `useMachineCrud.ts:49,73`.

**N-15 — PUT device: `null` untuk IP/firmware yang dikosongkan → 400 (panel).**
Spec PUT `/devices/{deviceId}`: `ipAddress` harus string ipv4|ipv6 bila ada; `null` TIDAK diizinkan. Panel `updateDevice` SELALU mengirim kedua field, `null` bila form dikosongkan (`useDevices.ts:150-151`). Kosongkan IP/firmware di DeviceEditModal → simpan → 400 VALIDATION_ERROR. Panel: `http/devices.ts:165`. Perbaikan: omit field null, bukan kirim null.

**N-16 — Shifts: `ShiftSchema` HH:MM ketat vs spec string polos (panel).**
Spec `startTime`/`endTime` hanya string TANPA format (diverifikasi: ada `startTime`, tanpa format time). Panel `ShiftSchema` menuntut `HH:MM` ketat via `mustParse` (`schemas/dto.ts:328`) — bila server mengembalikan `07:00:00`, SELURUH list melempar INVALID_RESPONSE. Data shift live belum pernah teramati (401-gated di Fase 1). Mencakup GET list/by-id, POST, PATCH. Panel: `mappers/assets.ts:107`, `http/production.ts:125,143`.

**N-17 — Shift schedules: `dayOfWeek` 1..7 vs spec number tanpa konvensi (panel).**
Spec `dayOfWeek` hanya number TANPA rentang/konvensi. Panel `ShiftScheduleSchema` menuntut int 1..7 (1=Senin..7=Minggu, mustParse) — bila server memakai 0..6 (0=Minggu), item `dayOfWeek=0` melempar INVALID_RESPONSE dan SELURUH list gagal; bila memakai 0..6 tanpa 0, label hari bergeser. Mencakup GET list/by-id, POST, PATCH. Panel: `schemas/dto.ts:338`, `mappers/assets.ts:120`.

**N-18 — PATCH shift-schedule mengirim `lineId` yang tak ada di body spec (panel).**
Body spec PATCH hanya `{shiftId?, dayOfWeek?, isActive?}` (tanpa `lineId`); panel `updateShiftSchedule` menyebarkan `{...patch}` termasuk `lineId`, dan UI `ShiftSchedulesPage` SELALU mengirim `lineId` saat edit. Bila server validasi strict (zod) → edit jadwal 400; bila tidak strict, field diabaikan. Panel: `http/production.ts:232`, `ShiftSchedulesPage.tsx:143`.

**N-19 — Filter WO ID diam-diam tidak berfungsi (panel).**
Spec `GET /work-orders` tidak punya param `wo_id`; panel `buildWorkOrdersEndpoint` mengirimnya bila filter WO ID diisi. Server mengabaikan query tak dikenal (terkonfirmasi API_LIVE_AUDIT.md) → list tidak terfilter. Melanggar keputusan D-12 (hanya kirim param terdaftar). Panel: `useHistoricalQueries.ts:36`, `http/workOrders.ts:17`. Perbaikan: panel (filter client-side, atau hapus param).

**N-20 — `/health/detail`: DEGRADED hilang + `adminConnection` difabrikasi (panel).**
Spec status database/mqtt enum `UP|DEGRADED|DOWN|UNKNOWN` (diverifikasi koordinator); panel `detailStatus()` hanya kenal UP/DOWN dan memetakan DEGRADED → `'UNKNOWN'`; tipe `HealthDetailStatus` tak punya DEGRADED. Plus spec `adminConnection` boleh null, panel selalu memfabrikasi objek berisi null. Panel: `http/health.ts:19,39`, `types/system.ts`.

**N-21 — Telemetry history: 4 field spec dilewatkan mapper (panel).**
`mapTelemetryHistory` melewatkan `currentState` (fsm_state selalu `'UNCONFIGURED'`), `operatingTimeSec`, `runTimeSec`, `actualCycleTimeSec` (→ `cycle_time_ms` 0). *Pct string diparse `num()` dengan benar. Panel: `mappers/monitoring.ts:146`.

**N-22 — Reconciliation jobs: mapper baca field yang tak ada (panel).**
Spec `{jobId, applicationName, scheduleInterval, maxRuntime, lastRunStartedAt, lastSuccessfulFinish, lastRunStatus}`; mapper baca `name/view_name/last_run/lastStatus/…` → nama `''`, `last_run` = epoch 1970, status selalu `'SUCCESS'`. Bentuk live dikonfirmasi probe API_LIVE_AUDIT. Panel: `mappers/monitoring.ts:392`, `http/telemetry.ts:80`.

**N-23 — Query `limit` wajib di spec tapi panel tak selalu mengirim (panel).**
`GET /quality/rejects` (+by-device) tidak mengirim query SAMA SEKALI; `GET /oee/hourly` tanpa limit via `useOeeAnalytics`; `GET /telemetry/{id}/hourly` tanpa limit via `useWorkOrderCorrelation`; limit ekspor op-events opsional di tipe panel. Spec mewajibkan `limit` → risiko 400 di setiap panggilan (server menegakkan query wajib — terbukti untuk `machine_id`/`device_id` OEE). Panel: `http/telemetry.ts:113,126`, `http/monitoring.ts:220,348`.

**N-24 — Encoding ekspor: spec JSON-string vs panel baca teks mentah (panel).**
6 operasi ekspor (downtime per-device, op-events global + per-device, system-audit, telemetry, telemetry hourly): spec 200 = `application/json` string; panel `reqExport` membaca body sebagai teks CSV mentah — bila server meng-JSON-encode string itu, CSV rusak (dikutip, escape `\n` literal, rowCount 0). Perlu cek live (endpoint 401-gated; belum terverifikasi). Panel: `http/transport.ts:reqExport`.

**N-25 — Downtime mapper: kategori selalu 'OTHER' + param tak terdaftar + tipe operator (panel).**
Spec item downtime TIDAK punya `category` → mapper default `category='OTHER'` selamanya; builder mengirim query param `category` yang TIDAK terdaftar di spec (spec: from/to/unlabeled_only/active_only/limit/cursor/envelope) — filter kategori tak berpengaruh di Real mode. Plus `POST /{id}/reason`: `operator` spec berupa objek `{id, username}`, panel mengetikkannya `string|null` (laten — UI tak merendernya hari ini). Panel: `mappers/monitoring.ts:66`, `http/monitoring.ts:37,60,71`.

**N-26 — Telemetry rollup: `group_by='line'` tak dikenal + `envelope=true` tak terdaftar (panel).**
Spec `group_by` enum mencakup `'line'`; panel `TelemetryRollupGroupBy` (`machine|day|month`) + Zod tidak mengenal `'line'` → tak bisa diminta, dan `mustParse` melempar bila server mengembalikan baris `groupBy 'line'`. Builder mengirim `envelope=true` yang TIDAK terdaftar di spec (respons selalu `{data,meta}`). Panel: `mappers/monitoring.ts:267`, `http/monitoring.ts:299`, `schemas/dto.ts:419`.

**N-27 — OEE shift-summary: counts + nama tak ada — parts selalu 0 (panel).**
Spec respons TANPA `totalCount/goodCount/rejectCount` → `total_parts/good_parts/defect_parts` mapper selalu 0; tanpa nama shift/mesin → `shift_name 'Shift'`, `machine_name ''`. (`time_sec`/`window`/`target_per_hour`/`hourly` cocok.) Panel: `mappers/monitoring.ts:305`, `http/telemetry.ts:14`.

**N-28 — MQTT overview: status di-hardcode + `lastOperation` + `reason` (panel).**
`dynamicSecurity.status` di-hardcode `'READY'` (spec enum READY/CONNECTING/DISCONNECTED); `configuration.lastOperation` objek|null di spec, panel mengetikkannya string|null → selalu null; varian `available=false` punya `reason` yang dibuang panel. (Count null dipertahankan dengan benar, E20.) Panel: `mappers/system.ts:204`, `types/mqtt.ts:BrokerOverviewInfo`.

**N-29 — Config GET: `unmanaged[]` objek + default fabrikasi (panel).**
`unmanaged[]` di spec berupa objek `{key, section, line, reason}`; panel memetakan tiap item dengan `String(u)` → `"[object Object]"`. Default fabrikasi `max_queued_messages` 1000 / `max_inflight_messages` 20 saat server kirim null (spec nullable) tersisa padahal E20 menghapus default lain. (Trailing slash path panel TIDAK masalah — B38/K-03.) Panel: `http/mqttConfig.ts:42`.

**N-30 — Config raw: dokumen JSON ditampilkan sebagai teks config (panel).**
Spec mengembalikan JSON `{metadata:{source, checksum, sizeBytes, modifiedAt, mosquittoVersion}, text:string}`; panel `fetchRaw` mengembalikan SELURUH body teks (dokumen JSON) sebagai 'teks config' dan membuang metadata → tampilan Raw menunjukkan JSON, bukan isi mosquitto.conf. Panel: `http/mqttConfig.ts:87`.

**N-31 — Config operations: `type` salah petakan + timestamp epoch (panel).**
Spec `type` APPLY/ROLLBACK/DISCARD|null; panel memetakan ke `'RELOAD'` (atau null); tipe panel hanya kenal NO_OPERATION/RELOAD/RESTART|null. Juga dibuang: domainStatus/domainAction/phase/actorId/actorName/startedAt/finishedAt/error/result; `timestamp` jadi epoch 1970. Status dibaca benar sehingga polling apply/rollback tetap jalan. Panel: `mappers/system.ts:92`, `http/mqttConfig.ts:283,293`.

**N-34 — Ekspor op-events: filter `event_type` tidak dikirim padahal spec menerimanya (panel).**
Panel TIDAK mengirim `event_type` pada ekspor op-events (global + per-device) padahal spec menerimanya (`machine_id`/`machineId`/`event_type`/`eventType` terdaftar); komentar panel mengklaim D-12/O8 'tanpa machine_id/event_type' — bertentangan dengan spec live. Catatan: `machine_id` yang TIDAK dikirim sudah benar (B23: hanya `/system/audit` yang memuatnya) — gap ini khusus `event_type`. Panel: `http/monitoring.ts:130`, `endpoints.ts:76`.

### 6.3 Low (9)

**N-32 — Device health `eventFlags`: asumsi bit belum terverifikasi (panel/backend).**
Spec `eventFlags` number (bitmask) TANPA definisi bit. Panel `decodeEventFlags` mengasumsikan bit 1=NTP_SYNCED, 2=MQTT_TLS_ACTIVE, 4=MODBUS_HEALTHY, 8=MODBUS_RETRY (asumsi backend lama, AUDIT.md:126) — bila live memakai pemetaan bit berbeda, label di drawer salah tanpa tanda. Field lain cocok. Panel: `mappers/assets.ts:166`. Diturunkan ke Low karena ini pertanyaan yang butuh jawaban backend (mirip R-item), bukan kerusakan terkonfirmasi.

**N-33 — DynSec status: bentuk spec bertentangan total, laten (panel).**
Spec `{connected, subscribed, connecting, pluginReady, brokerUrl, adminUsername, lastError, lastConnectedAt}`; panel baca `enabled/status/clients_count/roles_count/groups_count` — tak satu pun ada → selalu `{enabled:false, status:'DISCONNECTED', 0,0,0}`. LATEN: terekspos via apiClient tapi tak ada pemanggil UI (hanya `contractAlignment.test.ts:485`). Panel: `mappers/system.ts:239`. Diturunkan ke Low karena tanpa pemanggil UI (perbaiki saat endpoint dipakai).

**N-35 — WO cancel/resolve: fabrikasi respons (panel).**
Cancel mengabaikan `work_order.status` dari respons dan meng-hardcode `'ABORTED'`; resolve memfabrikasi `break {start:'', end:'', minutes:0}` bila spec `break` absen (opsional) dan men-default-kan `targetPerHour` ke 0 bila absen/null (0 vs 'tidak diketahui' dibedakan). Panel: `http/workOrders.ts:81,39`.

**N-36 — IAM info: `catalogueVersion` dibuang (panel).**
Spec 200 wajib `{mode, effectiveInMode, enforcedDomains, catalogueVersion, authzVersion}`; panel `mapIamInfo` MEMBUANG `catalogueVersion` (tak ada di tipe `IamInfo`) dan menjadikan `enforcedDomains` opsional. UI tidak menampilkan versi katalog dari endpoint ini — dampak kecil. Panel: `mappers/system.ts:271`, `types/iam.ts`.

**N-37 — Legacy POST /devices: model/serial dibuang + `mac_address` diwajibkan (panel).**
Spec body `{deviceId*, macAddress?, ipAddress?, firmwareVersion?}` — TIDAK ada `model`. Panel `registerDevice` menerima `model?`/`serial_number?` di tipe input tetapi transport MEMBUANG keduanya diam-diam; sebaliknya tipe panel mewajibkan `mac_address` padahal spec opsional. Panel: `http/devices.ts:56`, `useDevices.ts:92`.

**N-38 — Halaman login tanpa badge mode API / indikator koneksi (panel).**
Terkonfirmasi dari kode + browser task: grep `LoginPage.tsx` untuk Demo/Real/ApiMode/badge = 0 hit; badge mode API hanya ada di Topbar (`Topbar.tsx:193-228`) yang dirender di dalam `AdminLayout` — `/login` di luar layout (`Router.tsx:37`), jadi pengguna belum login tak pernah melihat indikator mode (Real vs Demo). Juga tidak ada indikator status koneksi backend (hanya pesan error pasca-submit) dan tidak ada label mode akses Private/Public (hanya banner read-only kondisional saat REMOTE_TUNNEL); subtitle "(LAN)" teks statis. Preset demo benar-benar tidak dirender di Real (gating `isDemoPresetLoginEnabled()` benar) — itu BUKAN gap.

**N-39 — `MQTT_CONFIG_GET`: trailing slash di template registry (panel).**
Template registry `/api/v1/mqtt/configuration/` vs spec `/api/v1/mqtt/configuration`. Berfungsi hari ini (server terima keduanya, B38/K-03) — kosmetik, samakan saat ada sentuhan. Panel: `src/services/api/endpoints/mqtt.ts:186`.

**N-40 — Spec OpenAPI tidak mendeklarasikan respons error 401/400 (backend/spec).**
17 operasi Access Control di spec hanya mendeklarasikan `200` (atau `201` untuk POST policies), tetapi live mengembalikan 401 (8 op) / 400 (9 op) — lihat §5. Di luar IAM, 121/138 operasi cocok dengan spec. Panel menangani 401/400 secara generik, jadi dampak ke panel kecil; ini soal kelengkapan spec. Sisi: backend (lengkapi deklarasi `responses` + skema error di OpenAPI).

**N-41 — Perilaku 404 vs `[]` untuk device tak dikenal tidak konsisten (backend).**
`GET /telemetry/{device_id}/aggregate` dan `GET /downtime-events/{device_id}` mengembalikan `[]` (200) untuk device probe yang tidak ada, sementara history/hourly/quality-rejects mengembalikan 404 `DEVICE_NOT_FOUND` untuk ID yang sama (probe worker D). Inkonsistensi perilaku antar endpoint; panel menoleransi keduanya hari ini.

## 7. Yang sudah dikenal — BUKAN gap baru

| Temuan | Status |
|---|---|
| B6 (FAT-77, terbuka): skema respons IAM tak dipublikasikan | **Sebagian terjawab oleh spec ini** — skema baca IAM ADA (GET roles: array objek lengkap; POST policies 201: objek lengkap). Tersisa: 5 tulis tanpa skema (POST/PUT roles, POST permissions, POST/DELETE user-roles) + `GET /info` + `GET /access-control/audit` (tanpa content). Panel mengasumsikan bentuk dari api_docs lama. |
| R-21: skema `/info` + `/access-control/audit`; B12: kode 404 inspector + perilaku tanpa-assignment | Tetap terbuka. Aspek BARU dari endpoint yang sama (tipe elemen `roles`, N-7) dicatat terpisah. |
| D-2: `/auth/me` tanpa skema | Spec live juga bertipe `any` — tanpa skema sama sekali. Mapper toleran panel (3 bentuk) tetap berlaku. |
| HMI-only ×5 (command, dispatch, complete, validate-zone, initiate-from-zones) | By design (ADR-003); bukan gap. |
| N-5: produk tanpa `sku`/`isActive` | Dikonfirmasi spec (item produk tanpa kedua field). Tetap Low, FAT-172. |
| O1: derivasi `acknowledged` dari `acknowledgedAt` (op-events + system audit) | Spec juga mengirim field `acknowledged` boolean eksplisit yang panel abaikan — aman hanya bila server menjaga keduanya konsisten. |
| `event_type`: spec string polos, tanpa enum 32 nilai | Daftar 32 nilai panel hanya dari api_docs (O2), tanpa validasi runtime di spec. Bukan gap — dicatat sebagai sumber. |
| `GET /mqtt/configuration/status` (AUDIT §24.1: bentuk tak lengkap) | **TERJAWAB oleh spec ini** — bentuk lengkap kini terdefinisi (§6 N-10 adalah mismatch panel terhadap bentuk baru itu, bukan ketiadaan spec). |
| Trailing slash config GET | Aman (B38/K-03, server terima keduanya). |
| Apply/rollback 202 + polling operations | Cocok dengan spec. |
| N-2–N-4 (E22) | Tetap terbuka di Linear (FAT-170/171/173); tidak duplikasi di sini. N-1 tidak dijadikan issue (transien restart — 502 tidak muncul lagi di sweep ini). |

## 8. Temuan panel statis (worker E — tanpa browser)

**Registry 137 key: WIRED_UI 121, TRANSPORT_ONLY 16, UNREFERENCED 0.** UI tidak pernah memanggil `ADMIN_ENDPOINTS` langsung — semua lewat `apiClient.<method>()` (`client.ts:44`) → method transport → key registry.

**16 TRANSPORT_ONLY** (hanya dipakai `http/`+`demo/`(+test); method-nya tak pernah dipanggil UI) — BUKAN gap bernomor, dicatat sebagai temuan cakupan UI:

| Key | Keterangan |
|---|---|
| `IAM_PERMISSIONS_CREATE` | Satu-satunya IAM yang mati (17/18 IAM lain terhubung); UI IAM tak punya aksi buat permission baru |
| `LIVE_STATE_BY_DEVICE` | UI live-state hanya memakai list global |
| `MACHINES_STATUS_HISTORY` | Hanya dipakai test; tidak ada halaman riwayat status mesin |
| `MQTT_CONFIG_VERSION_GET` | `useBrokerConfig` memakai list, bukan get satu versi |
| `MQTT_DYNSEC_CLIENTS_GET`, `MQTT_DYNSEC_GROUPS_GET`, `MQTT_DYNSEC_ROLES_GET` | Halaman DynSec hanya memakai list, bukan detail per-item |
| `MQTT_DYNSEC_GROUP_CLIENTS_DELETE`, `MQTT_DYNSEC_GROUP_ROLES_DELETE` | UI tak punya aksi lepas client/role dari group |
| `MQTT_DYNSEC_STATUS` | Status DynSec tak ditampilkan di halaman mana pun (overview memakai `MQTT_OVERVIEW`) |
| `OPERATIONAL_EVENTS_BY_DEVICE` | Hanya demo-only; UI memakai list global |
| `OPERATORS_GET`, `PRODUCTION_LINES_GET`, `PRODUCTS_GET`, `SHIFTS_GET`, `SHIFT_SCHEDULES_GET` | Halaman terkait hanya memakai list, tanpa halaman detail |

**Endpoint baru E20 — semua TERHUBUNG:** `DEVICES_PROVISION` (`useDevices.ts:123`), `DEVICES_REVOKE` + `DEVICES_CREDENTIALS` (`DeviceDetailModal.tsx:53,75`), `SYSTEM_ACCESS_MODE` (`NetworkAccessContext.tsx:59`), `HEALTH_DETAIL` (`SystemHealthPage.tsx:29`), `SYSTEM_AUDIT` / `SYSTEM_AUDIT_EXPORT` (`useHistoricalQueries.ts:174`, `AuditTrailPage.tsx:62`). Koreksi saat verifikasi: `OPERATIONAL_EVENTS_DEVICE_EXPORT` WIRED_UI — satu method melayani global vs per-device (`device_id: deviceFilter`).

**Halaman login:** lihat N-38. Preset demo benar-benar tidak dirender di Real (gating `isDemoPresetLoginEnabled()` benar — `LoginPage.tsx:23,186`, `mode.ts:222-226`).

**vercel.json (ae3424a): BENAR** — satu rewrite `/(.*)` → `/index.html` adalah fallback SPA kanonis untuk BrowserRouter; aset `/assets/*` tetap dilayani sebagai file statis; tidak menabrak API eksternal. **Tapi BELUM berlaku di live:** remote `origin/main` masih `9653612`; `ae3424a` hanya lokal, belum di-push — `/login` masih 404 di live sampai di-push + redeploy Vercel.

## 9. Batasan — yang TIDAK bisa diperiksa di audit ini

1. **Tes panel via browser TERBLOKIR oleh N-6 (CORS).** Semua verifikasi runtime halaman terautentikasi menunggu perbaikan backend. Yang belum terverifikasi secara runtime: apakah 121 key WIRED_UI benar-benar mengembalikan data live di mode Real; tampilan badge Topbar "Real" di deployment live; isi halaman terautentikasi mana pun.
2. **Tanpa auth (tidak ada token di fase ini):** bentuk respons GET tergating hanya dibandingkan secara statis (spec vs kode) — belum dikonfirmasi terhadap respons live; handshake WS `/ws/telemetry` belum teruji; mutasi apa pun belum teruji; perilaku exact N-8 (400 vs jendela default) belum terverifikasi; encoding ekspor N-24 belum teruji live (endpoint 401-gated); data shift/shift-schedule live belum pernah teramati (N-16/N-17/N-18 bersifat laten sampai data terlihat); bit `eventFlags` N-32 butuh jawaban backend.
3. **Backend tidak stabil selama audit:** di-restart 3× hari ini (~15:27, ~15:52, ~16:18 WIB — uptime ~56 dtk saat probe D). Temuan N-1 (502) dari Fase 1 tidak muncul lagi — konsisten dengan transien restart.
4. **Probe curl tanpa Origin menguji backend, bukan akses browser** (lihat §2). Keberadaan rute + gating di §5 tidak berarti endpoint itu dapat diakses dari panel Vercel sebelum N-6 diperbaiki.

## 10. Scratch + bukti

- Spec: `~/workspace/oee-live-openapi.json` (1.340.764 byte, diunduh 19 Nov 16:16 WIB dari `https://oee.fadik.web.id/docs/openapi.json`).
- Daftar kanonis operasi spec: `~/workspace/tmp-spec-ops.json` (141 operasi).
- Worker A (parse+diff registry): `~/workspace/tmp-docsA.json`.
- Worker B (contract diff grup 1, 80 entri): `~/workspace/tmp-docsB.json`.
- Worker C (contract diff grup 2, 63 entri): `~/workspace/tmp-docsC.json`.
- Worker D (probe live, 138 hasil): `~/workspace/tmp-docsD.json`.
- Worker E (cek statis fitur panel): `~/workspace/tmp-docsE.md`.
- Matriks §4 dibuat programatik dari keempat JSON di atas (didedup 2 operasi overlap B/C: `GET /system/audit`, `GET /system/audit/export` — diambil verdict C).
- Dokumen terkait: `docs/API_SYNC_DIFF.md` (E20), `docs/API_SYNC_REVIEW.md` (R-1–R-23), `docs/BACKEND_SYNC_CLOSURE.md` (E21), `docs/API_LIVE_AUDIT.md` (Fase 1 + §11 koreksi parent), `AUDIT.md` §27–§28.
