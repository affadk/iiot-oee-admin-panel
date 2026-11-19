# API Sync Diff — Admin Panel vs API Documentation Terupdate

| | |
|---|---|
| **Epic** | E20 (P20.1, FAT-153) — sinkronisasi admin-panel IIoT OEE ke API docs terupdate |
| **Tanggal** | 2026-11-19 |
| **Repo panel** | `~/workspace/iiot-oee-admin-panel/` (hanya dibaca; laporan ini satu-satunya file yang ditulis) |
| **Dokumen baru** | `~/workspace/user/files/pasted-text.txt` (2100 baris, Fastify 5.x + spec 015/020/027/032/034/035/036/037/042/043) |
| **Metode** | 3 peneliti paralel: (1) registry + transport HTTP, (2) mapper + demo + types, (3) UI + pages + auth. Temuan lengkap per irisan: `~/workspace/tmp-e20-slice1-registry.md`, `~/workspace/tmp-e20-slice2-mappers.md`, `~/workspace/tmp-e20-slice3-ui.md` (file scratch di luar repo). |

**Legenda verdict:** **OK** = sudah cocok dengan dokumen baru · **CHANGE** = ada tapi method/path/body/response berbeda · **NEW** = ada di dokumen, belum ada di panel · **REMOVE** = ada di panel, tidak ada/dilarang di dokumen. Nomor baris dokumen = baris `pasted-text.txt`; nomor baris panel = file repo.

> **Catatan kepala — verifikasi E21 (19 Nov 2026, `docs/BACKEND_SYNC_CLOSURE.md`):**
> diff ini sudah diverifikasi baris-per-barissebagai dasar penutupan gap E21 —
> 34 gap **TERSELESAIKAN** + 2 **BERUBAH/DIGANTIKAN** (B13, B30) = 36/50
> ditutup di Linear; 14 masih terbuka (B3, B6, B11, B12, B17, B23, B31–B37,
> B41). **Koreksi terhadap penilaian E20 awal:** (1) **R-7 terjawab** — aturan
> null `oeePct` saat Performance null sudah tertulis di api_docs §K:1163 +
> §K.3c:1194 (D-8 didukung dokumen; C14 bukan lagi kontradiksi terbuka);
> (2) **R-15 premisnya salah** — `DeviceResponse` membawa `lastSeenAt`
> (§E:~412), jadi klien dapat memverifikasi proyeksi TTL `isOnline`
> (§7E:2061); C13 bukan lagi kontradiksi terbuka; (3) **enum `event_type`
> eksplisit = 32, bukan 33** — terverifikasi hitung token (§I:1073–1075);
> implementasi panel sudah benar 32. **Caveat amandemen 09:23:** salinan
> `pasted-text.txt` di disk adalah upload asli 07:47 WIB — amandemen 09:23
> TIDAK ada di file (0 hit `access-mode` / `authorize("cancel"`, baris 1340
> masih `/clients/provision`); penutupan definitif butir amandemen (R-3,
> R-9, endpoint `GET /api/v1/system/access-mode`) menunggu salinan api_docs
> baru = **R-23**. Lihat `docs/API_SYNC_REVIEW.md` §2 untuk status
> R-1–R-23 terkini.

**Fakta yang sudah diputuskan (dicatat, tidak diputuskan ulang):**
- **K-11 E18 DIGANTIKAN:** `POST /clients` (provision dynsec) digantikan oleh **`POST /devices/provision`** per §E dokumen baru (spec 015, ADR-009) — dikonfirmasi §E.3a (dok baris 442–478).
- **P-I (`GET /health/detail`) kini tidak terblokir** — endpoint ada di dokumen baru (§A baris 95–149).
- **D1–D5+D7** adalah scope implementasi yang disetujui.
- **Aturan mengikat E18:** satu alur kanonis per item, tanpa deprecated yang tersisa.

**Catatan hitung (penting):** ketiga irisan memeriksa lapisan yang tumpang-tindih — satu akar masalah yang sama (mis. body policy snake_case, `accessMap`, gerbang `mustChangePassword`) muncul di 2–3 irisan. Hitungan per irisan di bawah **bukan** hitungan perubahan unik. Hitungan unik kasar ada di §1. Satu koreksi aritmetika: laporan irisan 1 menulis "132 kunci → OK 109, CHANGE 22, NEW 10, REMOVE 1, Total 132" — jumlahnya 142. Yang benar: **132 kunci registry → OK 109, CHANGE 22, REMOVE 1** (109+22+1=132); **10 NEW adalah endpoint di dokumen yang belum ada di registry**, di luar 132.

## 1. Ringkasan eksekutif

### Hitungan verdict per irisan

| Irisan | Diperiksa | OK | CHANGE | NEW | REMOVE |
|---|---|---|---|---|---|
| 1 — Registry + transport HTTP | 132 kunci registry + 10 endpoint baru + 1 metode transport | 109 | 22 | 10 | 2 (1 registry + 1 transport) |
| 2 — Mapper + demo + types | 108 item field-per-field | 35 | 61 | 7 | 5 |
| 3 — UI + pages + auth | 43 item perilaku | 18 | 19 | 4 | 2 |
| **Total entri verdict** | **294** | **162** | **102** | **21** | **9** |

Dari 10 NEW irisan 1, **5 adalah admin-scope** (`POST /devices/provision`, `POST /devices/:deviceId/revoke`, `POST /devices/:deviceId/credentials`, `GET /health/detail`, `GET /system/audit/export`) dan **5 HMI-only yang sengaja dikecualikan panel** (command, dispatch, complete, validate-zone, initiate) — tetap dicatat NEW menurut definisi, di luar scope admin.

### Temuan terberat (Real mode akan gagal/berbohong, bukan kosmetik)

1. **Provisioning masih rute lama, pengganti kanonis belum ada.** `POST /devices/provision` nol hit di seluruh `src`; panel hanya punya `POST /devices` legacy + cabang `isProvision` → `POST /mqtt/dynamic-security/clients/provision` (`http/mqttDynsec.ts:92-102`, `demo/mqttDynsec.ts:84-89`). Modal UI mengumpulkan password dari user, padahal dokumen: password dibuat backend dan hanya dikembalikan sekali.
2. **`accessMap` masih hidup** (`http/mqttDynsec.ts:74,87`): `readwrite → 'telemetry+state'` — nilai hasil tidak ada di dokumen baru mana pun.
3. **`mapDevice` melempar untuk device terikat.** Mapper membangun `boundMachine` dari field device, padahal server mengirim `{machineId, machineName}` dan skema menuntut `{machine_id, name, modbus_slave_id}` (`mappers/assets.ts:30-41`, `schemas/dto.ts:225-229`).
4. **Body tulis policy snake_case akan diabaikan server.** Panel mengirim `role_id/permission_id/resource_pattern/eft/abac_condition/is_active` + `reason`; dokumen §3.4: "Body tulis camelCase — tidak ada alias snake_case… field asing diabaikan; field wajib hilang → `400 INVALID_POLICY`".
5. **Effective-permissions membaca field yang dilarang.** Mapper membaca `effectiveRoles`; dokumen: "`roles` adalah satu-satunya nama field (tanpa alias `effectiveRoles`, Q-037-04)" — daftar role kosong di Real mode.
6. **Gerbang `mustChangePassword` belum ada sama sekali.** Nol hit `mustChangePassword`/`must_change_password` di `src`; `LoginResponseSchema` membuang flag; tidak ada state/redirect/penanganan 403.
7. **Lockout lokal panel masih hidup** (`LoginPage.tsx:36-88`, 5/30 dtk) — dokumen §L: "panel TIDAK menerapkan lockout paralel"; server 5/60s + `Retry-After` adalah satu-satunya sumber throttle. `Retry-After` tidak dibaca di mana pun.
8. **Mapper operational-event mengarang data.** Tidak membaca `description`/`recordedAt`, tidak menurunkan `acknowledged` dari `acknowledgedAt`, mengarang `severity` (default `'INFO'`) + `machine_name: 'Plant System'` — dokumen: severity tidak ada; `machineName` null bila mesin dihapus.
9. **Sinyal null `*Pct` di-koersi ke 0.** `mapHourly`/`mapAggregate`/`mapRollup` + skema tak-nullable: bucket tanpa sampel (`null` menurut dokumen) tampil 0 atau melempar `mustParse`.
10. **Health sintetis.** `http/health.ts:16-60` mengarang `label 'API v1'`, `environment 'production'`, latency 0, mqtt `'UP'`; dokumen: nilai tak tersedia = `null`/`UNKNOWN`, bukan 0/`UP`.

### Yang sudah OK (jangan diregresi saat implementasi)

Registry 109/132 kunci OK (seluruh production lines/shifts/schedules/products 20/20, machines 7/8, devices 5/6, operators 6/7); live-state camelCase; shift-summary; timeline; reject pareto `{reason,count,pct}`; bind/unbind machines; error envelope §2; `GET /health`; ack body `{note?}`; `PATCH /operators/:id/password` + `/status`; validator ABAC struktur; `mapIamAssignment/Permission/Info`; `mapMqttClient/Role/Group`; `mapBrokerConfigVersion`; demo `registerDevice` legacy; `mapTelemetryHistory`; `mapReconciliationJob`; export op-events + telemetry; tidak ada referensi PIN di UI.

## 2. Registry — 132 kunci (irisan 1)

### Ringkasan per domain

| Domain | Kunci | OK | CHANGE | REMOVE |
|---|---|---|---|---|
| Health + WS | 2 | 1 | 1 | 0 |
| Auth | 4 | 1 | 3 | 0 |
| Devices | 6 | 5 | 1 | 0 |
| Machines | 8 | 7 | 1 | 0 |
| Production (lines/shifts/schedules/products) | 20 | 20 | 0 | 0 |
| Operators | 7 | 6 | 1 | 0 |
| Work Orders | 4 | 3 | 1 | 0 |
| Monitoring | 12 | 10 | 2 | 0 |
| Telemetry / OEE / Quality | 13 | 11 | 2 | 0 |
| IAM / Access Control | 18 | 13 | 5 | 0 |
| MQTT (dynsec + overview + config) | 38 | 32 | 5 | 1 |
| **Total** | **132** | **109** | **22** | **1** |

### Detail CHANGE (22)

| # | Kunci registry | Perubahan | Panel | Dokumen |
|---|---|---|---|---|
| R1 | `WS_TELEMETRY` | Nama event downtime salah: panel `DOWNTIME_STARTED`/`DOWNTIME_ENDED`; dokumen `DOWNTIME_EVENT_OPENED`/`DOWNTIME_EVENT_CLOSED` — event nyata dibuang sebagai unknown type | `src/services/ws/telemetrySocket.ts:66-90,38-49` | §4 (~1870–1880) |
| R2 | `AUTH_LOGIN` | `must_change_password` dibuang skema; lockout lokal 5/30 dtk vs server 5/60s; `Retry-After` 429 tidak dibaca | `http/auth.ts:16-31`, `schemas/dto.ts:126-136`, `LoginPage.tsx:27-28,67-76`, `mode.ts:433-438` | §L 1223–1227 |
| R3 | `AUTH_REFRESH` | `authzVersion` respons dibuang; `refreshSession` kembalikan `tokenAuthzVersion` modul yang tak pernah diperbarui jalur HTTP (selalu 0); `AUTHZ_STALE` tidak dibedakan (semua 401 → logout) | `http/auth.ts:33-49`, `schemas/dto.ts:138-141`, `http/transport.ts` | §L 1232; §6D |
| R4 | `AUTH_ME` | `access.*` tidak dibaca; `isActive/isProtected/mustChangePassword` tidak dipetakan; per-capability `domain/surface/mode/reason` dibuang | `http/auth.ts:67-76`, `mappers/system.ts:286-329` | §3.4 ~1553–1555; §L 1245 |
| R5 | `DEVICES_CREATE` | `mac_address` diwajibkan + selalu dikirim (dok: opsional); `model`/`serial_number` diterima tapi tidak dikirim | `http/devices.ts:35-63` | §E.3 428–440 |
| R6 | `MACHINES_STATUS_HISTORY` | Filter `state` tidak dikirim; tidak ada validasi `from >= to` → `400 INVALID_RANGE` | `http/machines.ts:45-69` | §F.8 717–744 |
| R7 | `OPERATORS_CREATE` | `isActive` tidak dikirim (tipe punya, body tidak) — operator selalu dibuat aktif | `http/operators.ts:34-63` | §H.3 ~925–950 |
| R8 | `WORK_ORDERS_RESOLVE` | `device_id` opsional di panel; dokumen: **required** | `http/workOrders.ts` | §C.3 |
| R9 | `OPERATIONAL_EVENTS_LIST` | Trailing slash `/operational-events/`; dokumen menulis tanpa slash dan hanya menyatakan `ignoreTrailingSlash` untuk mqtt configuration | `endpoints/monitoring.ts` | §I 1007; §3.3b 1406 |
| R10 | `SYSTEM_AUDIT` | Filter `machine_id` tidak dikirim | `http/monitoring.ts:156-180` | §I 1069–1077 |
| R11 | `RECONCILIATION_REFRESH` | Body `{startWindow, endWindow}`; dokumen: `{from, to}` | `http/telemetry.ts:85-104` | §K.6 1207–1218 |
| R12 | `OEE_SHIFT_TIMELINE` | Default bucket `'15m'`; dokumen: default `5m` | `http/telemetry.ts:44-72` | §Q.3 1755–1758 |
| R13 | `IAM_PERMISSIONS_CREATE` | Body `{action, resource_type}`; kanon: `resourceType` | `http/iam.ts:99-114` | §3.4 ~1485 |
| R14 | `IAM_POLICIES_CREATE` | Body snake_case + `reason` (lihat §6) | `http/iam.ts:229-244` | §3.4 ~1512–1530 |
| R15 | `IAM_POLICIES_UPDATE` | Body snake_case + `reason` (lihat §6) | `http/iam.ts:246-265` | §3.4 ~1512–1530 |
| R16 | `IAM_SUBJECT_EFFECTIVE_PERMISSIONS` | Baca `effectiveRoles`; kanon: hanya `roles`; field `isActive/isProtected/authzVersion/effectiveInMode/assignments` dibuang | `http/iam.ts:282-296`, `mappers/system.ts:243-270` | §3.4 ~1553 |
| R17 | `IAM_AUDIT` | Tidak ada filter (hanya `limit`) | `http/iam.ts:298-312` | §3.4 |
| R18 | `MQTT_OVERVIEW` | Status panel `CONNECTED/DISCONNECTED` vs dokumen `"READY"`; count `null` di-koersi ke 0 (dilarang FR-035-51); `lastError/measuredAt/lastOperation` tidak dipetakan | `http/mqttDynsec.ts:14-21`, `mappers/system.ts:177-199` | §3.3a ~1372–1404 |
| R19 | `MQTT_CONFIG_GET` | Default fabrikasi (`max_connections` 1000, `max_packet_size_bytes` 268435456, `max_queued_bytes` 0, `autosave` 300); dokumen: field tanpa sumber = `null`; `unmanaged[]` tidak dipetakan | `http/mqttConfig.ts:15-49` | §3.3b ~1421–1440 |
| R20 | `MQTT_CONFIG_STATUS` | Bentuk respons asumsi panel (`active_version`/`sync_state` tidak muncul di dokumen); tipe tak kenal `UNAVAILABLE` | `http/mqttConfig.ts:63-83` | §3.3b 1406–1420 |
| R21 | `MQTT_CONFIG_VERSION_APPLY` | Harap respons `{version, operation}`; dokumen: 202 `{operationId, versionId}` | `http/mqttConfig.ts:154-174` | §3.3b 1418–1419 |
| R22 | `MQTT_CONFIG_VERSION_ROLLBACK` | Sama seperti R21 | `http/mqttConfig.ts:183-203` | §3.3b 1418–1419 |

### Detail REMOVE (1 registry + 1 transport)

| # | Item | Panel | Dokumen |
|---|---|---|---|
| R23 | `MQTT_DYNSEC_CLIENTS_PROVISION` — `POST /api/v1/mqtt/dynamic-security/clients/provision` | `endpoints/mqtt.ts:49-50`; dipakai `http/mqttDynsec.ts:92-102`, `demo/mqttDynsec.ts:84-89` | Digantikan `POST /devices/provision` (§E.3a 442–478; K-11). §M masih mendokumentasikannya — lihat kontradiksi C1/C5 |
| R24 | `createBrokerConfigBackup` → `POST /backups` | `http/mqttConfig.ts:248-265` | §3.3b 1467: "`POST /backups` tidak disediakan (`404`). Backup dibuat otomatis saat apply/rollback." |

### Detail NEW (10) — 5 admin-scope + 5 HMI-only

| # | Endpoint dokumen | Dokumen | Catatan panel |
|---|---|---|---|
| N1 | `POST /api/v1/devices/provision` | §E.3a 442–478 (spec 015, ADR-009); §6B 1960 | Pengganti K-11. Nol hit di `src`. Kredensial sekali tampil `{credential:{username,password,clientId,topicPrefix}}`; guard 409 `DEVICE_ALREADY_REGISTERED`/`DEVICE_ID_HAS_HISTORY`/`MACHINE_ALREADY_BOUND`/`MQTT_CLIENT_EXISTS`; 500 `PROVISION_ROLLED_BACK`; 502 `MQTT_PROVISION_FAILED` |
| N2 | `POST /api/v1/devices/:deviceId/revoke` | §E.3b 480–484; §6B 1961 | Body `{reason}` 1..200 wajib; 409 `DEVICE_ALREADY_REVOKED`. Nol hit di `src/services/api` |
| N3 | `POST /api/v1/devices/:deviceId/credentials` | §E.3c 486–496; §6B 1962 | Body `{force, reason}`; guard produksi 409 `DEVICE_IN_PRODUCTION` bila WO aktif tanpa `force:true` |
| N4 | `GET /health/detail` | §A 95–149 | ADMIN/LAN only, grant `read` pada `access_control`; respons per-komponen + `measuredAt`. P-I tidak terblokir |
| N5 | `GET /system/audit/export` | §I 1079–1083 | CSV/NDJSON/JSON, retensi 90 hari → 400 `RETENTION_EXCEEDED`, rate limit 5/min, `X-Export-*` |
| N6 | `POST /api/v1/devices/:device_id/command` | §D 338–390 | HMI-only, sengaja dikecualikan panel (FORBIDDEN `/command`) |
| N7 | `POST /api/v1/work-orders/:wo_id/dispatch` | §C.4 | HMI-only, dikecualikan (`/dispatch`) |
| N8 | `POST /api/v1/work-orders/:wo_id/complete` | §C.5 | HMI-only, dikecualikan (`/complete`); body `{finalRejectCount, notes?}`; 400 `SCRAP_COUNT_INVALID` |
| N9 | `POST /api/v1/work-orders/validate-zone` | §C.7 | HMI-only, dikecualikan |
| N10 | `POST /api/v1/work-orders/initiate-from-zones` | §C.8 | HMI-only, dikecualikan |

## 3. Transport HTTP — lintas-moda

| Item | Panel | Dokumen | Verdict |
|---|---|---|---|
| Base URL (`VITE_API_URL` atau origin + `/api/v1`, fallback `:3001`) | `mode.ts: resolveApiBaseUrl()` | §1 9–27 (LAN 80, tunnel 8080, daemon 3001) | OK |
| Timeout baca 10 dtk / mutasi 15 dtk / ekspor 120 dtk; retry GET-only maks 3, hanya 502/503/504 + gagal jaringan, backoff + jitter; mutasi tidak di-retry | `http/transport.ts: fetchRaw`, `schemas/transport.ts:198-201` | Dokumen tidak menetapkan timeout/retry klien | OK |
| Envelope error `{error, message, issues?}` + aditif `active_wo_id` | `schemas/transport.ts:113-143` | §2 24–62; §7F | OK |
| `details` pada 422 dibuang (hanya `issues` diteruskan) | `schemas/transport.ts:113-143` | §3.3b: `{error:"CONFIG_VALIDATION_FAILED", issues:[...], details:{validation}}` | CHANGE |
| Fallback kode: 502 → `MQTT_ADMIN_ERROR`, 503 → `SERVICE_UNAVAILABLE` | `schemas/transport.ts:147-169` | §2: 502 = `MQTT_PROVISION_FAILED`; 503 = `DEVICE_OFFLINE`/`MQTT_UNAVAILABLE`; 504 → `MQTT_RESPONSE_TIMEOUT` (cocok) | CHANGE |
| Penanganan 204: `reqJson` kembalikan `undefined`; semua DELETE kembalikan `{success:true}`; tidak ada mutasi harapkan body dari 204 | `http/transport.ts:242` | §M: DELETE dynsec → 204; §6B: "tidak ada mutasi memakai 204" (kontradiksi C2) | OK (penanganan benar; dokumen bertentangan) |
| `Retry-After` 429 tidak dibaca di mana pun | nol hit `Retry-After` di `src` | §L 1227: login `429 + Retry-After: <sisa detik>` | CHANGE |
| Semua 401 → logout (tidak bedakan `AUTHZ_STALE`) | `http/transport.ts: reqJson` | §L 1232: subjek stale → `401 AUTHZ_STALE` | CHANGE |
| Kode error baru: `INERT_PERMISSION`, `PERMISSION_EXISTS`, `SHIFT_TIME_OVERLAP`, `PASSWORD_CHANGE_REQUIRED`, `AUTHZ_STALE`, `SUBJECT_INACTIVE`, `ROLE_IMMUTABLE`, `DEVICE_ALREADY_REVOKED`, `DEVICE_IN_PRODUCTION`, `DEVICE_ID_HAS_HISTORY`, `MQTT_PROVISION_FAILED`, `PROVISION_ROLLED_BACK`, `must_change_password` — nol hit di `src` (hanya pass-through generik) | `mapHttpErrorToApiError` meneruskan string `error` apa pun | §2 44–62 + §L + §E + §3.4 | CHANGE (tidak ada penanganan khusus) |
| WS heartbeat klien 25 dtk vs server 30 dtk | `mode.ts` (`VITE_WS_HEARTBEAT_MS`) | §4 | OK |

## 4. Auth + gerbang ganti-password-wajib (spec 043)

| # | Item | Panel | Dokumen | Verdict |
|---|---|---|---|---|
| A1 | Gerbang `mustChangePassword` | TIDAK ADA: `LoginResponseSchema` (`schemas/dto.ts:126-136`) membuang flag; `AuthContext.login` (`context/AuthContext.tsx:144-165`) tidak membaca; tidak ada state/redirect/penanganan 403; demo login tidak pernah menyetel flag | "Selama `must_change_password=true`, setiap rute terproteksi selain `GET /auth/me` dan `POST /auth/password/change` dibalas `403 {error: \"PASSWORD_ROTATION_REQUIRED\", ...}`" (§L 1247–1250); login 200 bawa `operator.must_change_password` (§L 1227); "`GET /auth/me` tetap `200` saat gerbang rotasi aktif" (§L 1243–1245) | NEW |
| A2 | Lockout lokal panel | MASIH ADA: `LoginPage.tsx:36-40,76-88,190-201` (5 percobaan/30 dtk) + `mode.ts:433-438` (`VITE_LOGIN_MAX_ATTEMPTS`/`VITE_LOGIN_COOLDOWN_SEC`) | "Rate limit … default `5/60s` … satu-satunya sumber kebenaran throttle; **panel TIDAK menerapkan lockout paralel**" (§L 1224–1226) | REMOVE |
| A3 | Login 429 pakai cooldown env, bukan header server | `LoginPage.tsx:67-72`; `mapHttpErrorToApiError` tidak membaca `Retry-After` | Login `429 + Retry-After: <sisa detik>` (§L 1227) | CHANGE |
| A4 | Login password (bukan PIN) | Label "Password (min. 8 karakter)"; body `{operator_id, password, station_id?}` | "Verifikasi `operator_id` + password (PBKDF2…)" (§L 1224); "`POST /api/v1/auth/operator-pin` DIHAPUS total → `404`" (§L 1228) | OK |
| A5 | Ganti password sukarela (Topbar) | Body `{current_password, new_password}` (`http/auth.ts:51-71`) | "`{current_password, new_password min-8}` — kanonis, tanpa alias: `{old_password, ...}` → `400 VALIDATION_ERROR`" (§L 1236–1241) | OK |
| A6 | Referensi PIN | Hanya pola terlarang `'/auth/operator-pin'` di `endpoints.ts:14,55`; tidak ada PIN di UI | PIN "dihapus total" (§L 1228); `PATCH /:id/password` "ganti `/pin`" (§H 971) | OK |
| A7 | Refresh buang `authzVersion` | `RefreshResponseSchema` hanya `{success, token, expires_in}`; `refreshSession` kembalikan `authz_version: tokenAuthzVersion` (variabel modul, tak pernah diperbarui jalur HTTP — selalu 0) | Refresh kembalikan `{success, token, expires_in, authzVersion}` — "hasil pembacaan ulang identitas dari basis data (FR-037-10/11)" (§L 1232; §6D) | CHANGE |
| A8 | Demo login fallback password min 4 | `demo/auth.ts:47-52` | Password min-8 (`AUTH_PASSWORD_MIN_LENGTH` default 8) (§L 1227) | CHANGE |

## 5. Devices + provisioning kanonis (spec 015, ADR-009)

| # | Item | Panel | Dokumen | Verdict |
|---|---|---|---|---|
| D1 | `POST /devices/provision` | Nol hit di seluruh `src` (registry, transport, demo, UI) | "Membuat identitas broker + registry dalam satu aksi… Password dibuat backend (32 char `A-Za-z0-9-_`) dan hanya dikembalikan sekali" (§E.3a 441–447); body `{deviceId, machineId?, model?}` (449–455); otorisasi `create:device` **dan** `manage:mqtt_admin` (447–449) | NEW |
| D2 | Alur provision di UI (modal dynsec) | `CreateMqttClientModal.tsx:20-63` mode deviceId+access: username bebas, password WAJIB dari user (min 8), `deviceId` default `STM32-OEE-06`, `access` dipetakan `accessMap`; `useMqttClientMutations.ts:24-44` → cabang `isProvision` | Jalur resmi §E.3a (D1); `clientId = username = deviceId`; password backend-generate; ada field `machineId`/`model` untuk bind langsung | CHANGE |
| D3 | `accessMap` | `http/mqttDynsec.ts:74,87` (`publish→'telemetry'`, `subscribe/readwrite→'telemetry+state'`); demo sama (`demo/mqttDynsec.ts:78-130`) | Nilai `'telemetry'`/`'telemetry+state'` tidak muncul di dokumen baru; §M memakai `access:"readwrite"` apa adanya; §E.3a tidak memakai field `access` | REMOVE |
| D4 | Revoke + rotasi kredensial device (UI) | Tidak ada tombol/menu di `DevicesPage`/`DeviceTable`/`DeviceDetailModal`/`DeviceHealthDrawer` | `POST /devices/:deviceId/revoke` body `{reason}` 1..200 wajib, "selalu diizinkan" (§E.3b 465–471); `POST /devices/:deviceId/credentials` body `{force, reason}`, guard 409 `DEVICE_IN_PRODUCTION` (§E.3c 473–481) | NEW |
| D5 | Register manual legacy | `DeviceRegisterModal` + `http/devices.ts:35-64` `POST /devices`; `model`/`serial_number` di input tapi dibuang di http layer | "`POST /api/v1/devices` — registri manual (legacy)… dipertahankan untuk masa transisi… Gunakan `POST /provision` untuk alur lengkap" (§E 425–431); `DeviceResponse` memuat `model` (399–417) | CHANGE |
| D6 | Field device baru | Tipe `EdgeDevice` (`types/assets.ts:40-52`), mapper (`mappers/assets.ts:19-44`), seed (`seeds/assets.ts:173-230`) tidak mengenal `enrollmentState`/`provisionedAt`/`credentialRotatedAt`/`boundMachine` | `enrollmentState: PROVISIONED\|ACTIVE\|REVOKED`, `provisionedAt`, `credentialRotatedAt`, `boundMachine: {machineId, machineName} \| null` (§E 405–425, 442–480); siklus `PROVISIONED → ACTIVE → REVOKED` (395) | NEW |
| D7 | `mapDevice` bentuk `boundMachine` salah | Mapper bangun `{device_id, mac_address, ip_address, firmware_version, online}`; `BoundMachineSummarySchema` menuntut `{machine_id, name, modbus_slave_id}` — `mustParse` melempar untuk setiap device terikat di Real mode | Server kirim `{machineId, machineName}` (§E 405–425) | CHANGE |
| D8 | `EdgeDeviceSchema` tolak `macAddress: ""` | `schemas/dto.ts:213-226` wajib regex EUI-48 | "MAC boleh kosong saat provisioning; … respons API memakai `\"\"` sampai teramati" (§E 395, 470) | CHANGE |
| D9 | Tabel device | Tidak tampilkan `enrollmentState`/`provisionedAt`/`credentialRotatedAt` (`DeviceTable.tsx`, `DevicesPage.tsx`) | `DeviceResponse` memuat ketiganya (§E 399–417, 457–475) | CHANGE |
| D10 | Demo `deleteDevice` / `registerDevice` kode guard | `MACHINE_HAS_ACTIVE_WO` (183–196); duplikat → kode `CONFLICT` generik (103–116) | Guard delete → `409 CONFLICT` (§E 499–505); tabel §2 bedakan `DEVICE_ALREADY_REGISTERED` vs konflik MAC | CHANGE |
| D11 | Demo provision/revoke/rotasi | Tidak ada (`demo/devices.ts`, `endpoints/devices.ts`) | §E 442–492; §6B 1960–1962 | NEW |

## 6. IAM kanonis (spec 042) + ABAC (spec 024/032)

| # | Item | Panel | Dokumen | Verdict |
|---|---|---|---|---|
| I1 | Body tulis policy snake_case | `createIamPolicy`/`updateIamPolicy` kirim `{...data}` snake_case: `role_id/permission_id/resource_pattern/eft/abac_condition/is_active` (`http/iam.ts:229-265`); tipe `IamPolicyRule` + `IamPolicyRuleSchema` snake_case (`types/iam.ts:29-40`, `schemas/dto.ts:144-156`) | "Body tulis **camelCase** — tidak ada alias snake_case (`role_id`, `permission_id`, `resource_pattern`, `abac_condition`, `is_active`, `eft`). Field asing diabaikan; field wajib hilang/salah tipe → `400 INVALID_POLICY`" (§3.4 ~1511–1521); kanon `{roleId, permissionId, resourcePattern, effect, abacCondition}` | CHANGE |
| I2 | `reason` pada baris policy | Mapper baca `reason` (`mappers/system.ts:183`); tipe + skema bawa `reason`; UI create/update kirim `reason` (`usePolicies.ts:50-88`); demo `addIamRolePermission` isi `reason` default (`demo/iam.ts:214`); seed policy bawa `reason` (`seeds/system.ts:202-259`) | "`reason` pada mutasi policy/assignment **hanya** disimpan di audit IAM… Baris policy (`GET /policies`, `POST`, `PUT`) **tidak** memuat field `reason`; jangan mengisinya di panel" (§3.4 1507) | REMOVE |
| I3 | `mapIamPolicy` field hilang + `role` salah semantik | `role` diturunkan dari `subjectMatch` (`mappers/system.ts:174`); `createdAt`/`resourceType` dibuang (tipe tak punya) | Baris kanonis: `roleId, roleName, subjectMatch, resourcePattern, effect, abacCondition, enabled, createdAt, resourceType` (§3.4 1523–1545) | CHANGE (+ NEW untuk `createdAt`/`resourceType`) |
| I4 | `createIamPermission` kirim `resource_type` | `http/iam.ts:99-114` body `{action, resource_type, description}` | Kanon `resourceType`; duplikat → `409 PERMISSION_EXISTS`; tanpa rute penjaga → `400 INERT_PERMISSION` (§3.4 ~1485–1486) | CHANGE |
| I5 | `mapIamRole` default `privilege_level: 1` + `policy_count` | `mappers/system.ts:153-165`; `IamRoleSchema` (`schemas/dto.ts:160-168`); demo `getIamRoles` hitung `policy_count` (`demo/iam.ts:36-42`); seed role bawa `privilege_level: 40/30/20/10/25` (`seeds/system.ts:86-118`); badge UI "Level {privilege_level}" (`RolesTab.tsx:104`) | "`privilege_level` dan `policy_count` **TIDAK** dikembalikan backend — jangan diisi nilai default di panel" (§3.4 1556); `GET /roles` kembalikan `[{id, name, description, isSystem, templateVersion, createdAt, effectiveInMode, policies[]}]` (1547–1549) | CHANGE |
| I6 | Demo role wajib `privilege_level` 1–29 | `demo/iam.ts:44-135` (`CUSTOM_ROLE_MAX_LEVEL`) | Hierarki level statis dihapus backend (FR-032-20); `privilege_level` tidak dikembalikan | REMOVE |
| I7 | Kunci preset role | Teks UI `RolesTab.tsx:76` + guard demo (`demo/iam.ts:93,121-124`) kunci 4 preset; seed hanya ADMIN `is_system:true` (`seeds/system.ts:83-119`) — tombol Edit/Hapus tampil untuk 3 preset lain tapi gagal di demo | "Hanya `ADMIN` yang immutable… `SUPERVISOR`, `OPERATOR`, `MAINTENANCE` adalah preset opsional — dapat diubah atau dihapus bila tidak dipakai (FR-RL-002)" (§3.4 1494–1496); `DELETE /roles/:id`: ADMIN → `403 ROLE_IMMUTABLE`; ter-assign → `409 ROLE_IN_USE` (1559–1561) | CHANGE |
| I8 | Demo `deleteIamRole` | Blokir semua role sistem; hapus policy role diam-diam (162); tidak sebut `operatorId` pada `ROLE_IN_USE`; tidak bedakan `ROLE_IMMUTABLE` dari `FORBIDDEN` | Dok §3.4 1475–1476, 1505–1506, 1555 | CHANGE |
| I9 | Demo `revokeIamUserRole` 404 | `demo/iam.ts:389-418` tanpa baris cocok → `404 NOT_FOUND` | "Tanpa baris cocok → `200 {success:true, removed:0}` (idempoten, bukan 500)" (§3.4 1493) | CHANGE |
| I10 | Demo `createIamPermission` selalu tolak | `demo/iam.ts:310-320` lempar `PERMISSION_CATALOG_READ_ONLY` 403 | "`POST /permissions` ada — buat permission baru; tanpa rute penjaga → `400 INERT_PERMISSION`; duplikat → `409 PERMISSION_EXISTS`" (§3.4 1486) | CHANGE |
| I11 | `mapIamSubjectEffectivePermissions` baca `effectiveRoles` | `mappers/system.ts:243-270` baca `r.effectiveRoles ?? r.effective_roles`; tidak pernah baca `r.roles`; buang `isActive/isProtected/authzVersion/effectiveInMode/assignments` | "`roles` adalah satu-satunya nama field (tanpa alias `effectiveRoles`, Q-037-04)"; respons `{operatorId, primaryRole, isActive, isProtected, authzVersion, effectiveInMode, assignments[], roles[], permissions[]}` (§3.4 ~1553) | CHANGE (+ NEW untuk field hilang) |
| I12 | `CapabilityKey` tanpa `access_control.read` | `specs.ts:12-47` punya `manage` saja; semua baca IAM digate `manage` (`http/iam.ts:23` dkk.; `Sidebar.tsx:115`) | Tabel §3.4: GET `/roles`/`/permissions`/`/user-roles`/`/policies`/`/audit`/`info` = "ADMIN + `read` access_control"; hanya tulis = `manage` (§3.4 1473–1491); "`access_control.read` dan `access_control.manage` sebagai **dua kunci terpisah**" (1513–1515) | CHANGE |
| I13 | Kunci capability karangan | `export.telemetry`, `audit.system.read`, `dashboard.read`, `downtime.reason.label` (panel); `demo/helpers.ts:106,118` petakan hanya di demo; `evaluateCapability` (`engine.ts:126`) cocokkan apa adanya di Real | Katalog kanonik `<domain>.<action>`; ekspor op-events memakai policy `refresh:telemetry` (§I 1085–1087); ekspor system-audit `authorize("read","access_control")` (§I 1079–1083); ekspor server "SUPERVISOR/ADMIN LAN only" | CHANGE |
| I14 | ABAC whitelist atribut | Panel 10 atribut camelCase (`networkMode, subjectActive, actorLineId, …` — `utils/capabilities/abac.ts:7-18`); validator struktur OK (`all`/`any`/`not`, satu comparator — `abac.ts:24-95`) | §3.4 1502 sebut "whitelist 10 atribut" **tanpa enumerasi**; satu-satunya contoh memakai `{"attr": "subject.line_id", "eq": "LINE-01"}` (1520) — bentuk dotted snake_case yang ditolak validator panel | CHANGE (lihat kontradiksi C11) |
| I15 | Demo `createIamPolicy` tanpa validasi ABAC | `demo/iam.ts:428-450` terima kondisi apa pun | Predikat tak sah → `400 INVALID_POLICY` (FR-032-31/35) (§3.4 1502) | CHANGE |
| I16 | `mapAuthMe` / `AuthMeResponse` | Hanya bentuk flat; hilang `operator.isActive/isProtected/mustChangePassword`, `authz.attributes`, `access.{mode,channel,mutations_allowed}`, per-capability `domain/surface/mode/reason`; `primaryRole` default `'OPERATOR'` bila absen; skema baca capability field `state` (dok: `decision`) | §L 1245 (flat) vs §3.4 1554 (nested) — kontradiksi C3; `AuthMeResponseSchema` (`schemas/dto.ts:86-125`) | CHANGE |
| I17 | `IAM_AUDIT` tanpa filter | `http/iam.ts:298-312` kirim `{limit, envelope: true}` | "`/audit` | GET | Daftar audit keputusan otorisasi (**filter subject/decision/mode/from/to**)" (§3.4) | CHANGE |
| I18 | `Operator.role` enum + hierarki | `UserRole = ADMIN|SUPERVISOR|OPERATOR|MAINTENANCE` (`types/auth.ts:1`); `assignableRoles` pakai `canManageTargetRole` + `ROLE_LEVELS` 40/30/20/10 (`specs.ts:44-53,112-118`); label modal "Peran Awal (Dibatasi Hierarki)" | "`role` adalah **string bebas**, bukan enum: … default `UNASSIGNED`, hanya `ADMIN` yang dibatasi untuk akun root `ADM-001`… daftar role otoritatif ada di `GET /access-control/roles`" (§H 867–869); "bukan hierarki level (FR-032-20)" (§H 905–907, 933–935) | CHANGE |
| I19 | `mapOperator` default `OPERATOR` + `line_id` `LINE-01` | `mappers/assets.ts:81-84` | "`role` … default `UNASSIGNED`" (§H 865–875); `lineId` selalu dikirim server | CHANGE |
| I20 | Demo `updateOperator` hierarki + tanpa `ADMIN_SINGLETON_DENIED` | `demo/operators.ts:99-144` pakai `canManageTargetRole`; nol hit `ADMIN_SINGLETON_DENIED` di `src` | "Perubahan label dicek terhadap larangan ADMIN ganda (`ADMIN_SINGLETON_DENIED`)…, bukan hierarki level (FR-032-20)" (§H 946–960) | CHANGE |
| I21 | Demo `toggleOperatorStatus` ADM-001 → 403 | `demo/operators.ts:224-228` lempar `PROTECTED_ACCOUNT` 403 | `PATCH /operators/ADM-001/status {isActive:false}` → **400** `PROTECTED_ACCOUNT` (§H 989–1004); delete ADM-001 → 403 (sudah benar) | CHANGE |
| I22 | Mode otorisasi `partial` | Panel enum `'shadow'|'enforce'|'partial'` (`types/auth.ts`); `SystemInfoPage` tampilkan "Penegakan Aktif" untuk apa pun bukan `shadow` | Mode `AUTHZ_MODE=shadow` (default) / `enforce` + `AUTHZ_ENFORCE_DOMAINS` flip per-domain (§3.4 1563–1573) | OK |

## 7. Operational events + audit (FR-034)

| # | Item | Panel | Dokumen | Verdict |
|---|---|---|---|---|
| O1 | `mapOperationalEvent` | Tidak baca `description` (pesan dari `message/details/eventType`); tidak baca `recordedAt` (timestamp dari `timestamp/createdAt`); `acknowledged` dibaca dari field, tidak diturunkan dari `acknowledgedAt`; buang `woId/triggerSource/eventCode/snapshotTotalCount/snapshotRunSec`; `machine_name` default `'Plant System'`; default `event_type: 'STATE_CHANGE'` bila absen | Bentuk `OperationalEventItem` FR-034-01 (§I 1020–1047): `id, recordedAt, deviceId, machineId, machineName, woId, eventType, triggerSource, eventCode, snapshotTotalCount, snapshotRunSec, description, acknowledged, acknowledgedAt, acknowledgedBy, ackNote, createdAt`; "`acknowledged` adalah turunan dari `acknowledgedAt`" (1046); "`machineName` bernilai `null` bila mesin sudah dihapus" (1047) | CHANGE |
| O2 | Enum `event_type` panel 15 nilai | `types/monitoring.ts:74-89`; dropdown `OperationalEventsFilters.tsx:8-16`; seed `seeds/monitoring.ts:308-417` | Enum tertutup FR-034-26/27 (§I 1073–1075): **32 nilai eksplisit** + pola `COMMAND_<cmd>_DISPATCHED` (6 cmd), `MQTT_ADMIN_<op>`, `DEVICE_EVENT_<n>` (n = 0..255). Irisan dengan panel hanya 8 nilai. Nilai tebakan panel yang tidak ada: `ALARM, STATE_CHANGE, COMMAND_EXECUTED, DISCONNECT, HEARTBEAT_TIMEOUT, MQTT_ADMIN_ACTION, IAM_POLICY_CHANGED` | CHANGE |
| O3 | `severity` (tipe + kolom + filter) | Tipe `severity: 'INFO'|'WARN'|'CRITICAL'` (`types/monitoring.ts:90`); mapper default `'INFO'` (`mappers/monitoring.ts:80`); kolom `useOperationalEventColumns.tsx:25-40`; dropdown `OperationalEventsFilters.tsx:137-143`; state `OperationalEventsPage.tsx:20,35,85`; query `types/historical.ts:79`; demo filter lokal (`demo/monitoring.ts:232-234`) | FR-034-01 **tidak punya field severity**; "Parameter tak dikenal (mis. `severity`) diabaikan dengan `200` (Q-034-07); filter `severity` tidak didukung pada rilis ini" (§I 1078–1080). Builder Real **tidak mengirim** `severity` (`endpoints.ts:74-88`) — filter tampil tapi tidak berpengaruh di Real, berpengaruh di Demo | REMOVE (filter + kolom + tipe + query) |
| O4 | Filter `acknowledged` dibuang builder Real | `OperationalEventsPage.tsx:21,85-88` filter ACK/UNACK; `useHistoricalQueries.ts:153` teruskan; `buildOperationalEventsEndpoint` (`endpoints.ts:74-88`) TIDAK sertakan | `acknowledged` (`true`/`false`, optional) parameter resmi `GET /operational-events` (§I 1010–1016) dan `/:deviceId` (1098–1102) | CHANGE (bug builder, bukan penghapusan filter) |
| O5 | `mapAuditLog` / `AuditLogItem` | Mengarang `operator_id/operator_name`, `action` (fallback eventType), `resource_type` (default `'SYSTEM'`), `resource_id`, `client_ip: ''`, `access_mode: 'LAN'` (`mappers/monitoring.ts:95-115`, `types/system.ts:36-54`) | `/system/audit` adalah alias audit trail global yang kembalikan `OperationalEventItem[]` (§I 1069–1072); tidak satu pun field karangan itu ada di FR-034-01 | CHANGE |
| O6 | Ack note maks 500 vs 1000 | Modal `maxLength={500}` (`OperationalEventAckModal.tsx:57-60`); demo tolak >500 (`demo/monitoring.ts:311-316,336-338`) | Body ack hanya `{note?}` **max 1000 karakter** (§I 1114–1121) | CHANGE |
| O7 | Ack `operatorId` | Tidak dikirim — body `{ ...(note ? { note } : {}) }` (`http/monitoring.ts:133-145`) | "Aktor diambil dari subjek JWT… Body hanya `{note?}`… `operatorId`/`operator_id` masih diterima tetapi **deprecated dan diabaikan**" (§I 1113–1117) | OK |
| O8 | Export op-events | Ada (`OperationalEventsPage.tsx:165-176`, `http/monitoring.ts:118-129`, `endpoints.ts:92-106`); caveat: kirim `event_type` + `machine_id` ke endpoint export global yang hanya daftarkan `from, to, format, limit` | `GET /operational-events/export` + `/:deviceId/export`, csv/ndjson/json, limit 1..100000 default 10000, retensi 90 hari → `400 RETENTION_EXCEEDED`, rate limit 5/min (§I 1085–1112) | OK |
| O9 | Export system-audit | TIDAK ADA: `AuditTrailPage.tsx` tanpa toolbar/button export; tidak ada `exportSystemAudit` di `http/monitoring.ts`/`client.ts` | "`GET /api/v1/system/audit/export`… filter sama dengan daftar (`from`, `to`, `event_type`, `machine_id`)… Rate limit `5/min`, guard `enforceSubnetOrigin` + `authorize(\"read\",\"access_control\")`" (§I 1079–1083) | NEW |
| O10 | `getSystemAuditPage` tanpa `machine_id` | `http/monitoring.ts:157-179`; `AuditTrailPage` + `useSystemAuditQuery` hanya kirim `from, to, event_type, limit, cursor` | Query `/system/audit`: `from, to, event_type, machine_id, limit (1..200), cursor, envelope` (§I 1068–1070) | CHANGE |
| O11 | Kolom audit sintetis | Kolom "Aktor & Mode" (`operator_name`, `operator_id`, `access_mode`) + "Client IP" (`AuditTrailPage.tsx:52-64,110-118`); mapper isi default `''`/`'LAN'` | Bentuk `OperationalEventItem` (§I 1025–1043) tidak memuat ketiganya; "Respons tidak pernah memuat hash, salt, token, atau nilai `before`/`after`" (1043) | CHANGE |
| O12 | Pemisahan feed | `AuditTrailPage` baca `/system/audit`; `AuditTab` baca `/access-control/audit` terpisah; tanpa union view | "Feed ini **hanya operasional**; mutasi IAM dibaca dari `GET /api/v1/access-control/audit` (otoritas tunggal, tanpa union view)" (§I 1064–1066) | OK |
| O13 | `machine_id` dikirim ke endpoint global | `buildOperationalEventsEndpoint` + export endpoint kirim `machine_id` saat scope global (`endpoints.ts:74-88,92-106`) | `GET /operational-events` (global) hanya daftarkan `from, to, event_type, acknowledged, limit, cursor, envelope` — tanpa `machine_id` (§I 1005–1018); `machine_id` hanya di `/system/audit` (1068–1070) | CHANGE |
| O14 | Envelope paginasi | Mapper baca `meta.hasMore/nextCursor/count` | Envelope FR-034-30..34 (§I 1048–1068); `count` = jumlah baris halaman | OK |

## 8. Health (A)

| # | Item | Panel | Dokumen | Verdict |
|---|---|---|---|---|
| H1 | Sintesis health (Real) | `http/health.ts:16-60`: `backend.label` default `'API v1'`, `environment` default `'production'`, `latency_ms` default `0`, `database.latency_ms` default `0`, `mqtt.status` default `'UP'`, `mqtt.connected_clients` fallback ke `wsClients`, `mqtt.dynamic_security` default `'enabled'`; `SystemHealthPage.tsx:96-99` render "Produksi · Waktu Respons: {latency} ms" seolah terukur | `/health` kembalikan `{status, uptime, timestamp, ws_clients, db_connected, buffer_pending, buffer_dropped, metrics\|null}` — tanpa label/version/environment/latency per komponen (§A 65–97) | CHANGE |
| H2 | `GET /health/detail` | Tidak ada di registry/transport/demo/UI (`endpoints/health.ts` hanya `HEALTH` + `WS_TELEMETRY`) | "Status terukur per komponen (database, MQTT admin, WebSocket relay) plus identitas runtime… detail infrastruktur hanya untuk ADMIN di kanal LAN… `enforceSubnetOrigin` + penolakan eksplisit ingress `remote-tunnel`" (§A 99–111); otorisasi grant `read` pada `access_control` (ADMIN) (103); "Setiap komponen membawa `measuredAt` sendiri; nilai tidak tersedia = `null`/`UNKNOWN`, bukan `0`/`UP`" (113–115); "`database.latencyMs` diukur nyata di sekitar `SELECT 1`… gagal/timeout → `status: \"DOWN\"`, `latencyMs: null`" (115–119); "`application.version` dari `APP_VERSION`… `environment` dari `NODE_ENV`" (119–121) | NEW (P-I, tidak terblokir) |
| H3 | Metrik ingest nullable | `SystemHealthPage.tsx:160-191` tampilkan "belum tersedia" bila `metrics` null; `http/health.ts` teruskan `metrics: null` | "`metrics` bertipe nullable — bernilai `null` saat metrik ingest belum tersedia" (§A 69–71) | OK |
| H4 | Demo seed health | `INITIAL_SYSTEM_HEALTH` (`seeds/system.ts:10-29`) nilai tetap (uptime 1845920 dtk, `ws_clients: 3`, latency 12/8 ms, mqtt 4 klien); `demo/health.ts:19-27` hanya tempel timestamp baru | — (demo-only; harus tetap terpisah jelas dari data Real) | CHANGE (catatan: seed demo, bukan kontrak) |

## 9. MQTT dynsec / overview / config (§M, §3.3a/b)

| # | Item | Panel | Dokumen | Verdict |
|---|---|---|---|---|
| M1 | `mapMqttClient`/`mapMqttRole`/`mapMqttGroup` | `mappers/system.ts:21-72` | §M 1257–1371 | OK |
| M2 | `mapBrokerOverview` | Buang `available, lastError, measuredAt, lastOperation`; count `null` → 0; status `'READY'` diteruskan mentah ke tipe `CONNECTED/DISCONNECTED` | §3.3a 1372–1401: `dynamicSecurity: {available, enabled, status: 'READY', clientsCount, rolesCount, groupsCount, lastError, measuredAt}` (count `null` bila tak tersedia, bukan 0 — FR-035-51); `configuration: {status, activeVersionId, lastAppliedAt, mutationLocked, lastOperation, measuredAt}` | CHANGE |
| M3 | `BrokerOverviewInfo` type | Tanpa `available/lastError/measuredAt/lastOperation`; status salah; count diketik `number` bukan `number\|null` | §3.3a 1372–1401 | CHANGE |
| M4 | `BrokerConfigSchema` nullables | `max_connections: number`, `max_queued_bytes: number`, `autosave_interval_seconds: number`, `bridges[].remote_client_id: string`, `bridges[].status: 'CONNECTED'|…`, `tls_profiles: BrokerTlsProfile[]` | "Field tanpa sumber nyata bernilai `null`: `limits.max_connections`, `limits.max_queued_bytes`, `bridges[].remote_client_id`, `bridges[].status`; `tls_profiles` selalu `[]`" (§3.3b 1456) | CHANGE |
| M5 | `BrokerConfigVersion.status` | Panel kenal `STAGED|APPLIED|ACTIVE|ROLLED_BACK` | Status versi panel `STAGED/ACTIVE/ROLLED_BACK` saja; nilai domain asli di `domainStatus` (§3.3b 1463) | CHANGE |
| M6 | `BrokerOperation.type` | Panel `STAGE|APPLY|ROLLBACK|DISCARD` | `operation_type: NO_OPERATION/RELOAD/RESTART`; `type: null` untuk aksi `RECOVERY` (§3.3b 1463) | CHANGE |
| M7 | Demo stage validasi `max_connections` 10–50000 | `demo/mqttConfig.ts:115-123` tolak di luar rentang | Field itu `null` (atribut per-listener, tanpa sumber nyata) — validasi terhadap nilai yang tidak ada (§3.3b 1456) | CHANGE |
| M8 | Buat klien mode roles | Body `{username, password, roles:[{rolename, priority: 1}]}`; UI tegakkan min-1 role | Contoh `POST /clients` body `{"username":"edge_stm32_02","password":"…","clientid":"STM32-02","roles":[{"rolename":"device-edge_stm32_02","priority":0}]}` (§M 1363–1369); "pembuatan klien wajib ≥1 peran (FR-DSEC-007)" (§M 1273–1275) | OK (beda `priority` 1 vs 0 tidak dinyatakan sebagai kontrak) |
| M9 | Kredensial sekali-tampil (dynsec) | `useMqttClientMutations.ts:21-38` simpan `oneTimeSecret` hanya dari respons; `OneTimeSecretModal.tsx` | "Password tidak pernah dicatat atau dikembalikan ulang setelah pembuatan" (§M 1275–1277) | OK |

## 10. OEE / telemetry / rollup / live state (§K, §Q, §R, §6, §7)

| # | Item | Panel | Dokumen | Verdict |
|---|---|---|---|---|
| T1 | `mapHourly` | Buang `deviceId/machineId/woId`; `*Pct` nullable di-koersi ke 0; `state` diteruskan mentah tanpa normalisasi (`PLANNED_STOP` tak dikenal tipe) | Item kanonis §Q.2 (1749): `bucket, deviceId, machineId, woId, availabilityPct, performancePct, qualityPct, oeePct, totalCount, rejectCount, goodCount?, operatingSec, runSec, sampleCount, targetPerHour?, state?, planned?, provisional?`; `availabilityPct/oeePct` = `null` bila bucket belum memuat sampel ber-`udt` atau penyebut nol (§K 1163); `planned` true bila state `PLANNED_DOWNTIME`/`PLANNED_STOP` (§6E 2003) | CHANGE |
| T2 | `mapAggregate` | Koersi null → 0 untuk `availabilityPct/qualityPct/oeePct` (padahal `performancePct` sudah dipertahankan null — inkonsisten internal) | §7J 2086: `*Pct` string-numeric **nullable**; rumus `good = max(0, output − reject)` sudah benar | CHANGE |
| T3 | `mapRollup` | Koersi null → 0 yang sama | §K.3c 1194: `performancePct` null bila kapasitas nol/unknown; `availabilityPct/oeePct` null bila penyebut nol (1163) | CHANGE |
| T4 | Skema `*Pct` tak nullable | `TelemetryRollupItemSchema` + `TelemetryAggregatePointSchema` (`schemas/dto.ts:357-393`): `*Pct` string\|number (tanpa null), `sampleCount` wajib — `mustParse` melempar untuk bucket null yang sah | §K 1163; §7J 2086 | CHANGE |
| T5 | `mapShiftSummary` buang `hourly[]` | `mappers/monitoring.ts:284-345` abaikan `r.hourly` | Respons §Q.1 (1717–1731) mencakup `hourly[]` bila `include_hourly=true` | NEW |
| T6 | `HourlyOeePoint` tanpa `deviceId`/`machineId`/`woId` | `types/analytics.ts:29-46` | §Q.2 1749 | NEW |
| T7 | Timeline default bucket `15m` | `http/telemetry.ts:44`, `demo/telemetry/oee.ts:224` | §Q.3 1758; §7I 2091: bucket default `5m` (`1m|5m|15m|1h`) | CHANGE |
| T8 | HTTP OEE/telemetri minta auth | `http/telemetry.ts:21,52` + `http/monitoring.ts:193,218,303` panggil `assertAuthenticatedHttp()` | §Q 1708: "Agregat OEE read-only (tunnel-safe, tanpa auth)"; §7H 2075: `/live-state, /telemetry/*, /quality/*, /oee/*` read `open` | CHANGE |
| T9 | Body refresh rekonsiliasi | `{startWindow, endWindow}` (`http/telemetry.ts:92-107`) | Body `{from, to}` (§K.6 1215–1224) | CHANGE |
| T10 | Demo hourly tanpa `bucket` ISO | `buildDemoHourlyPoints` kembalikan `hour: '07:00'` (`HH:MM`), tanpa field `bucket` (`demo/telemetry/oee.ts:96-120`); `mapHourly` baca `bucket` dulu → `bucket: undefined` | §7B 2038–2050: bucket hourly/aggregate ber-kunci `bucket` ISO string; §K.2 1175: tiap item memuat `provisional` | CHANGE |
| T11 | Demo shift-summary hardcode | `planned_production_time_min: 480, operating_time_min: 420, run_time_min: 388, unplanned_downtime_min: 32, planned_downtime_min: 60` hardcode; `target_per_hour: derived?.targetPerHour ?? 64` — fallback 64 bertentangan nilai turunan demo sendiri (50) | §Q.1 1717–1731: `target_per_hour` datang dari server | CHANGE |
| T12 | Demo `oeePct: 0` saat kapasitas unknown | `demo/telemetry/helpers.ts:191`, `demo/telemetry/rollup.ts:85` | §K.3c 1194: kapasitas nol/unknown → `null` untuk Performance; nilai OEE pada kondisi itu **tidak ditegaskan dokumen** — 0 adalah fabrikasi (lihat kontradiksi C14) | CHANGE |
| T13 | `mapShiftSummary` / `mapTimelineSegment` / `mapTelemetryHistory` / `mapReject` / `mapReconciliationJob` | `mappers/monitoring.ts:117-184,284-374` | §Q.1 1717–1731; §Q.3 1756–1769; §R 1776–1803; §K 1210–1224 | OK |
| T14 | `telemetryDefaults` (groupBy day, bucket 5m) | `features/analytics/telemetryDefaults.ts:28-37` | §K 1192; §Q.3 1758 | OK |
| T15 | Live-state camelCase | `mapLiveState` baca field camelCase; angka string `"92.50"` ditangani; seed `INITIAL_LIVE_STATES` cocok | §B 155–180; §6C 1990–1993 | OK |
| T16 | `mapLiveState` `device_online: true` hardcode | `mappers/monitoring.ts:53` selalu isi `true` | §7E 2061: `isOnline` = proyeksi TTL atas `last_seen_at` (`DEVICE_PRESENCE_TTL_SEC=300`); live-state sendiri tidak membawa `isOnline` | CHANGE |
| T17 | Field live-state yang dibaca tapi tak ada | `spindleRpm`, `machineTempC`, `plcAlarmCode` (`mappers/monitoring.ts:44-46`) | Tidak ada di contoh respons §B (155–180) maupun §6C/§7B | REMOVE |
| T18 | FSM 6 nilai + `OFFLINE` | Tipe panel izinkan `state: MachineFsmState | 'OFFLINE'`; mapper normalkan `OFFLINE → UNCONFIGURED` (`mappers/assets.ts:146-161`, `oeeCalculations.ts:10-32`); seed item pakai `state: 'OFFLINE'` (`seeds/assets.ts:150-159`) | FSM kanonis 6 nilai (§6A 1947–1954, §7D 2055–2058) tanpa `OFFLINE`; hanya legacy `STANDBY → READY` yang dinormalisasi server — TAPI filter query status-history mencantumkan `OFFLINE` sebagai nilai `state` yang sah (§F.8 720). Lihat kontradiksi C12 | CHANGE |

## 11. Machines / operators / work orders / downtime

| # | Item | Panel | Dokumen | Verdict |
|---|---|---|---|---|
| W1 | `mapMachine` | `mappers/assets.ts:46-64` | §F 520–560 | OK |
| W2 | Demo bind/unbind | `demo/machines.ts:356-506` | §F 650–715 | OK |
| W3 | Demo unbind blokir WO `PENDING` juga | `demo/machines.ts:453-459` guard `ACTIVE || PENDING` | Guard unbind hanya `ACTIVE WO → 409 MACHINE_HAS_ACTIVE_WO` (§F.7 698–704) | CHANGE |
| W4 | `mapOperator` / `Operator.role` / create operator | Lihat I18–I21 (§6); create modal OK untuk password/body kecuali `isActive` (R7/B2) | §H 859–1004 | CHANGE |
| W5 | Demo `createOperator` / `rotateOperatorPassword` | `demo/operators.ts:44-97,185-203` | §H 911–940, 973–984 | OK |
| W6 | `mapWorkOrder` | Baca `actual_start`/`actual_end` (dok: `actual_start_at`/`actual_end_at`); tidak baca `dispatched_at/acked_at/provisional/count_uncertain`; mengarang `completed_quantity`/`rejected_quantity` (default 0); `planned_start` fallback ke `start_time` lalu `created_at` | §C 211, 219–240: item memuat `dispatched_at, acked_at, actual_start_at, actual_end_at (nullable), provisional, count_uncertain`; list: `wo_id, machine_id, machine_name, product_id, product_name, operator_id, operator_name, target_qty, status, created_at, start_time, end_time` | CHANGE |
| W7 | `WorkOrder` type | Status hanya `PENDING|ACTIVE|COMPLETED|ABORTED`; tanpa `dispatched_at/acked_at/actual_start_at/actual_end_at/provisional/count_uncertain`; `WorkOrdersQuery.status` ikut kehilangan `PENDING_CLOSE` | Status tambah `PENDING_CLOSE` — "status transisi resmi saat telemetri `BATCH_FINISHED` pertama" (§C 211, 204); `PENDING_CLOSE` nol hit di seluruh `src` | CHANGE |
| W8 | HTTP `resolveWorkOrder` / `cancelWorkOrder` / demo resolve | `http/workOrders.ts:36-113`; `demo/workOrders.ts:100-135` | §C 253–280, 303–318; §6E | OK (kecuali `device_id` required — R8) |
| W9 | `mapDowntime` | Baca `durationSec/duration_seconds` tapi **tidak** `duration_sec` — bila server kirim `duration_sec`, durasi tampil 0 | §7B/D1 2049: sumber kebenaran durasi downtime adalah `downtime_events.duration_sec` | CHANGE |
| W10 | Demo `unlabeled_only` heuristik | `!is_labeled || !reason || reason` mengandung `'unclassified'`/`'unplanned'` (`demo/monitoring.ts:107-115,140`) | `unlabeled_only=true` = `operatorReason IS NULL` (§7G 2067–2070) | CHANGE |
| W11 | Demo `classifyDowntimeReason` | Kembalikan `DowntimeEvent` penuh (`demo/monitoring.ts:158-205`) | Respons `200 {success, eventId, deviceId, operatorReason, isOverwrite, operator}` + WS `DOWNTIME_REASON_LABELED` (§J.3 1141–1158) | CHANGE |
| W12 | `DowntimeCategory` (10 nilai) + `getActiveDowntimes` | `types/monitoring.ts:48-58`; `demo/monitoring.ts:52-57` | §J 1147–1151, 1122–1128 | OK |

## 12. WebSocket (§4, §7A)

| Item | Panel | Dokumen | Verdict |
|---|---|---|---|
| URL `ws://…/ws/telemetry`, tanpa Bearer, heartbeat `"ping"`/`"pong"` 25 dtk, close code `4403`/`4429`, reconnect backoff 1 dtk → maks 30 dtk | `src/services/ws/telemetrySocket.ts`, `mode.ts` | §4 1811–1923 | OK |
| Envelope `TELEMETRY_UPDATE` diparse dari bentuk §7A maupun mentah §4; `is_buffered: true` diabaikan; tipe tak dikenal diabaikan tanpa putus koneksi | `telemetrySocket.ts` | §7A 2016–2030 | OK |
| Nama event downtime `DOWNTIME_STARTED`/`DOWNTIME_ENDED` | `KNOWN_WS_TYPES` (`telemetrySocket.ts:66-90`), tipe `TelemetryWsLifecycleEvent` (38–49); nol hit `DOWNTIME_EVENT_OPENED`/`DOWNTIME_EVENT_CLOSED` di `src` | §4 (~1870–1880): `DOWNTIME_EVENT_OPENED` / `DOWNTIME_EVENT_CLOSED` (+ `DOWNTIME_REASON_LABELED` — cocok) | CHANGE |
| 23 dari 25 tipe lifecycle lain cocok (`MACHINE_*`/`PRODUCT_*`/`PRODUCTION_LINE_*`/`SHIFT_*`/`SHIFT_SCHEDULE_*`/`WORK_ORDER_*`); `HEALTH_UPDATE`, `DEVICE_STATUS_UPDATE`, `DEVICE_EVENT` cocok | `telemetrySocket.ts:66-90` | §4 | OK |

## 13. Daftar hapusan deprecated (konsolidasi — aturan E18: hapus seluruhnya, bukan fallback)

| # | Yang dihapus | Lokasi panel | Dasar |
|---|---|---|---|
| X1 | Registry `MQTT_DYNSEC_CLIENTS_PROVISION` + cabang `isProvision` (HTTP + demo) | `endpoints/mqtt.ts:49-50`; `http/mqttDynsec.ts:92-102`; `demo/mqttDynsec.ts:84-89` | K-11 digantikan `POST /devices/provision` (§E.3a) |
| X2 | `accessMap` + default `'telemetry'` | `http/mqttDynsec.ts:74,87`; `demo/mqttDynsec.ts:78-130` | Nilai hasil tidak ada di dokumen; §E.3a/§M pakai `access` verbatim |
| X3 | `createBrokerConfigBackup` → `POST /backups` | `http/mqttConfig.ts:248-265` | §3.3b 1467: 404 |
| X4 | Lockout lokal login + env `VITE_LOGIN_MAX_ATTEMPTS`/`VITE_LOGIN_COOLDOWN_SEC` | `LoginPage.tsx:36-88,190-201`; `mode.ts:29-30,433-438` (+ `.env.example`) | §L 1224–1226: panel TIDAK lockout paralel |
| X5 | Filter + kolom + tipe `severity` (operational events) | `OperationalEventsFilters.tsx:8-16,137-150`; `OperationalEventsPage.tsx:20,35,85`; `useOperationalEventColumns.tsx:25-40`; `types/monitoring.ts:90`; `types/historical.ts:79`; `mappers/monitoring.ts:80`; `demo/monitoring.ts:232-234` | FR-034-01 tanpa severity (§I 1078–1080) |
| X6 | `reason` pada baris policy (baca + tulis + tipe + skema + seed + demo default) | `mappers/system.ts:183`; `types/iam.ts:39`; `schemas/dto.ts:155`; `usePolicies.ts:50-88`; `demo/iam.ts:214`; `seeds/system.ts:202-259` | §3.4 1507: hanya di audit IAM |
| X7 | Default `privilege_level`/`policy_count` + badge "Level" + validasi demo 1–29 + seed level | `mappers/system.ts:107-119,153-165`; `schemas/dto.ts:160-168`; `demo/iam.ts:36-42,44-135`; `seeds/system.ts:86-118`; `RolesTab.tsx:104` | §3.4 1556: jangan diisi default |
| X8 | Demo `createIamPermission` selalu tolak `PERMISSION_CATALOG_READ_ONLY` | `demo/iam.ts:310-320` | §3.4 1486: endpoint didukung + guard |
| X9 | Hierarki level peran (`ROLE_LEVELS`, `canManageTargetRole`, `CUSTOM_ROLE_MAX_LEVEL`, label "Dibatasi Hierarki") | `specs.ts:44-53,58,112-118`; `useOperators.ts:81`; `OperatorCreateModal.tsx:130`; `demo/operators.ts:99-144` | FR-032-20: bukan hierarki level |
| X10 | Demo login fallback password min 4 | `demo/auth.ts:47-52` | §L 1227: min-8 |
| X11 | Demo `deleteIamRole` blokir 4 preset + hapus policy diam-diam | `demo/iam.ts:93,121-124,137-165` | §3.4 1494–1496, 1505–1506 |
| X12 | Demo `revokeIamUserRole` 404 bila tak cocok | `demo/iam.ts:389-418` | §3.4 1493: 200 `{success:true, removed:0}` |
| X13 | Demo `toggleOperatorStatus` ADM-001 → 403 | `demo/operators.ts:224-228` | §H 989–1004: 400 |
| X14 | Sintesis health (`label 'API v1'`, `environment 'production'`, latency 0, mqtt `'UP'`, `dynamic_security 'enabled'`) | `http/health.ts:16-60` | §A 65–97, 113–115: nilai tak tersedia = `null`/`UNKNOWN` |
| X15 | Koersi count `null` → 0 di `mapBrokerOverview` + enum status `CONNECTED/DISCONNECTED` | `mappers/system.ts:177-199,210-231`; `types/mqtt.ts:43-56` | FR-035-51; §3.3a status `"READY"` |
| X16 | Default fabrikasi config (`max_connections` 1000, `max_packet_size_bytes`, `max_queued_bytes` 0, `autosave` 300) + validasi demo `max_connections` 10–50000 | `http/mqttConfig.ts:15-49`; `demo/mqttConfig.ts:115-123` | §3.3b 1456: field tanpa sumber = `null` |
| X17 | Field live-state fabrikasi (`spindleRpm`, `machineTempC`, `plcAlarmCode`, `device_online: true` hardcode) | `mappers/monitoring.ts:44-46,53` | §B 155–180; §7E 2061 |
| X18 | Heuristik demo `unlabeled_only` + `classifyDowntimeReason` kembalikan `DowntimeEvent` penuh | `demo/monitoring.ts:107-115,140,158-205` | §7G 2067–2070; §J.3 1141–1158 |
| X19 | Batas demo ack note 500 | `demo/monitoring.ts:311-316,336-338`; `OperationalEventAckModal.tsx:57-60` | §I 1114–1121: max 1000 |
| X20 | Nama event WS `DOWNTIME_STARTED`/`DOWNTIME_ENDED` | `telemetrySocket.ts:38-49,66-90` | §4: `DOWNTIME_EVENT_OPENED`/`DOWNTIME_EVENT_CLOSED` |
| X21 | Guard demo unbind blokir WO `PENDING` | `demo/machines.ts:453-459` | §F.7 698–704: hanya `ACTIVE` |
| X22 | Kode demo generik (`registerDevice` `CONFLICT`, `deleteDevice` `MACHINE_HAS_ACTIVE_WO`) | `demo/devices.ts:103-116,183-196` | §E 499–505; tabel §2 56 |
| X23 | Demo `createIamPolicy` tanpa validasi ABAC | `demo/iam.ts:428-450` | §3.4 1502: predikat tak sah → `400 INVALID_POLICY` |
| X24 | Demo `getSubjectEffectivePermissions` pakai `effectiveRoles` + field hilang | `demo/iam.ts:520-574`; `InspectorTab.tsx:74` | §3.4 1553: hanya `roles` |
| X25 | Enum `Operator.role` + default `OPERATOR`/`LINE-01` | `types/production.ts:69-76`; `schemas/dto.ts:82,188-196`; `mappers/assets.ts:81-84` | §H 865–875: string bebas, default `UNASSIGNED` |
| X26 | Seed IAM level + reason; seed op-events nilai tebakan + severity | `seeds/system.ts:86-118,202-259`; `seeds/monitoring.ts:308-417` | §3.4 1507, 1556; §I 1073–1075 |
| X27 | `mapAuditLog` field karangan (`operator_id/operator_name/action/resource_type/client_ip/access_mode`) | `mappers/monitoring.ts:95-115`; `types/system.ts:36-54` | FR-034-01 (§I 1020–1047) |
| X28 | Koersi null → 0 `*Pct` + skema tak-nullable + `oeePct: 0` saat kapasitas unknown | `mappers/monitoring.ts:196-282`; `schemas/dto.ts:357-393`; `demo/telemetry/helpers.ts:191`; `demo/telemetry/rollup.ts:85` | §K 1163, 1194; §7J 2086 |
| X29 | Body refresh rekonsiliasi `{startWindow, endWindow}`; default bucket timeline `15m`; `assertAuthenticatedHttp` pada OEE/telemetri read | `http/telemetry.ts:21,44,52,92-107`; `http/monitoring.ts:193,218,303`; `demo/telemetry/oee.ts:224` | §K.6 1215–1224; §Q.3 1758; §Q 1708; §7H 2075 |
| X30 | Fallback kode error 502/503 salah; `details` 422 dibuang; `Retry-After` tidak dibaca; `authzVersion` refresh dibuang | `schemas/transport.ts:113-169`; `http/auth.ts:33-49` | §2 44–62; §3.3b; §L 1227, 1232 |
| X31 | Demo hourly `hour: 'HH:MM'` tanpa `bucket`; demo shift-summary hardcode + fallback target 64 | `demo/telemetry/oee.ts:96-120,209-226` | §7B 2038–2050; §Q.1 1717–1731 |
| X32 | Normalisasi `OFFLINE → UNCONFIGURED` + seed item `state: 'OFFLINE'` | `mappers/assets.ts:146-161`; `oeeCalculations.ts:10-32`; `seeds/assets.ts:150-159` | FSM kanonis 6 nilai (§6A/§7D) — lihat kontradiksi C12 |
| X33 | `mapWorkOrder` field karangan/hilang + tipe tanpa `PENDING_CLOSE` | `http/transport.ts:81-107`; `types/production.ts:1-24` | §C 204, 211, 219 |
| X34 | `mapDowntime` tidak baca `duration_sec` | `mappers/monitoring.ts:57-73` | §7B/D1 2049 |

**Tidak dihapus (tetap, tapi diberi label legacy bila diputuskan — lihat §15 D-16):** `POST /devices` registrasi manual — dokumen §E menyebutnya "legacy/deprecated — dipertahankan untuk masa transisi". Pola terlarang yang tetap benar: `'/auth/operator-pin'`, `'/command'`, `'/dispatch'`, `'/complete'`, `'/work-orders/validate-zone'`, `'/work-orders/initiate-from-zones'`, `'/access-control/assignments'`, `'/downtime/export'`, `'/mqtt/configuration/versions'`.

## 14. Kontradiksi internal dokumen baru (dilaporkan, tidak diselesaikan)

| # | Kontradiksi | Lokasi dokumen | Dampak | Tingkat |
|---|---|---|---|---|
| C1 | Heading §M bilang provisioning `POST /clients`, cURL-nya memakai `/clients/provision` | §M 1317 vs ~1336–1340 | §M belum dibersihkan; panel mengikuti §E.3a (K-11) — dampak panel: tidak ada bila §E diikuti | Kontrak |
| C2 | §6B: "Tidak ada endpoint mutasi yang memakai `204`" vs tabel §M: 7× DELETE dynsec → 204 | §6B 1988 vs §M 1287, 1300, ~1305–1312 | Panel sudah tangani 204 dengan benar; dokumen perlu dibersihkan | Kontrak |
| C3 | Bentuk `/auth/me`: **tiga versi** — §L flat `{operator, authz}` (1245); §3.4 nested `{access, operator, authz}` (~1553–1555); §6B ringkas `{capabilities, mode}` (1984) | §L 1245; §3.4 1554; §6B 1984 | Panel hanya tangani flat; `access.*` tidak dibaca. Perlu backend tetapkan kanon (lihat §15 D-2) | Kontrak — blokir A4/R4/I16 |
| C4 | Kanon camelCase §3.4 vs deskripsi PUT /policies campur snake_case (`resource_pattern`/`abac_condition` di tengah `subjectMatch`/`effect`/`enabled`) | §3.4 ~1495–1498 vs ~1512–1516 | Tidak dapat ditentukan apakah server terima `resource_pattern` pada PUT | Kontrak — blokir I1 |
| C5 | §M arsitektur: "Provisioning per-device (root spec 015): `POST /api/v1/devices/provision`… rotasi/pencabutan `/devices/:id/credentials` dan `/devices/:id/revoke`" — lalu §M yang sama mendokumentasikan provisioning sebagai `POST /clients` / cURL `/clients/provision` | §M ~1273–1276 vs 1317, 1340 | §M inkonsisten dengan §E.3a dan dirinya sendiri; K-11 didukung §E.3a + kalimat §M sendiri | Kontrak |
| C6 | Baris ack duplikat di tabel §6B (`PATCH /operational-events/:id/ack` dua kali, ~1980 dan ~1986); respons ack §I ada `acknowledged:true`, tabel §6B tidak | §6B ~1980, 1986; §I 1114–1121 | Editorial; tidak pengaruhi kontrak | Editorial |
| C7 | `effectiveRoles` vs `roles`: §3.4 larang alias `effectiveRoles` untuk endpoint subjects, tapi §L memakai `effectiveRoles` di dalam `authz` `/auth/me` | §3.4 ~1553 vs §L 1245 | Tidak jelas apakah larangan alias hanya untuk endpoint subjects atau umum; panel baca `effectiveRoles` di kedua tempat | Kontrak — blokir I11/I16 |
| C8 | Otorisasi cancel WO: §C.6 "ADMIN LAN only" vs §7H "OPERATOR+ LAN" | §C.6 vs §7H 2071–2083 | Gating cancel tidak dapat diputuskan dari dokumen | Kontrak |
| C9 | Kode 404 mesin tanpa device: §Q intro `MACHINE_NOT_BOUND` vs §Q.2 `NOT_FOUND` | §Q ~1706–1709 vs ~1740–1745 | Penanganan error UI tidak dapat diputuskan | Minor |
| C10 | Work-orders snake_case vs devices/machines camelCase — keduanya nyata | §C vs §E–H | Bukan untuk "diperbaiki" sepihak; mapper panel sudah dual-alias | Fakta |
| C11 | ABAC: "whitelist 10 atribut" tanpa enumerasi; satu-satunya contoh `subject.line_id` (dotted snake_case) ditolak validator panel (10 nama camelCase) | §3.4 1502, 1520 | Tidak dapat diputuskan apakah whitelist panel benar — perlu daftar dari spec 032/024 lengkap | Kontrak — blokir I14 |
| C12 | `OFFLINE` ada di filter query status-history (§F.8) tapi tak ada di FSM kanonis 6 nilai (§6A/§7D, hanya normalisasi `STANDBY → READY`) | §F.8 720 vs §6A 1947–1954, §7D 2055–2058 | Tidak jelas apakah `OFFLINE` nilai item sah atau hanya nilai filter | Kontrak — blokir T18/X32 |
| C13 | `isOnline` adalah proyeksi TTL atas `last_seen_at`, tapi `DeviceResponse` tidak membawa `lastSeenAt` yang dapat diverifikasi klien | §7E 2061 vs §E 505–510, §6F 2009 | Klien terima `isOnline` jadi; tidak dapat verifikasi TTL sendiri | Minor |
| C14 | `oeePct` saat `performancePct` null tidak ditegaskan (§K.3c hanya nyatakan Performance → `null`) | §K.3c 1194 | Demo isi `oeePct: 0` — benar/salah tidak dapat diputuskan dari dokumen | Kontrak — blokir T12/X28 |
| C15 | **Premis tugas vs dokumen: `401 PASSWORD_CHANGE_REQUIRED` tidak ada di dokumen.** Yang ada: flag `must_change_password` di respons login 200 + gerbang `403 PASSWORD_ROTATION_REQUIRED` | §L 1227, 1247–1250 (grep `PASSWORD_CHANGE_REQUIRED` di dokumen = nol) | Implementasi gerbang harus mengikuti dokumen (flag + 403), bukan premis 401 — perlu konfirmasi eksplisit (§15 D-1) | Kontrak — blokir A1 |
| C16 | §H: "semua mutasi `ADMIN` LAN only" vs per-endpoint "ADMIN/SUPERVISOR" (POST §H.3, PATCH password §H.6, PATCH status §H.7) | §H 861 vs 905, 971–975, 983–987 | Gating `operator.create` dkk. tidak dapat diputuskan dari dokumen | Kontrak |
| C17 | Klausul abaikan parameter tak dikenal hanya ditulis untuk `/system/audit`; `event_type` enum tertutup di `/system/audit` tapi "string, optional" di `/:deviceId` tanpa klausul abaikan | §I 1068–1076 vs 1096–1102 | Panel kirim `machine_id` + `event_type` ke endpoint global/export yang tidak mendaftarkannya — aman/tidak belum terjawab | Kontrak — blokir O8/O13 |
| C18 | Dua guard berbeda untuk dua ekspor hampir sama: `/system/audit/export` → `authorize("read","access_control")`; `/operational-events/export` → policy `refresh:telemetry`, SUPERVISOR/ADMIN LAN | §I 1079–1083 vs 1085–1087 | Pemetaan guard per endpoint harus diputuskan di implementasi (panel kini satu kunci `export.telemetry` untuk keduanya) | Kontrak |
| C19 | Tabel error §2 tidak memuat kode yang dipakai di bagian lain: `ROLE_IMMUTABLE`, `PASSWORD_ROTATION_REQUIRED`, `WEAK_PASSWORD`, `AUTHZ_STALE`/`SUBJECT_INACTIVE`, `MQTT_CLIENT_ALREADY_EXISTS` dkk. | §2 44–62 vs §3.4, §L, §H, §M | UI yang andalkan tabel §2 saja salah memetakan kode-kode itu | Minor (dokumen) |
| C20 | Artefak redaksi di salinan dokumen: `must_change_password=<redacted>` di §L 1227, 1238, 1249 — nilai boolean literal terredaksi di `pasted-text.txt` | §L 1227, 1238, 1249 | Nilai eksak tidak dapat diverifikasi dari salinan ini; implementasi A1 merujuk sumber dokumen asli | Fakta (salinan) |
| C21 | §M: "Semua endpoint **ADMIN-only** (`verifyOperatorAuth([\"ADMIN\"])`)" vs §E provision butuh `create:device` **dan** `manage:mqtt_admin` (policy-based) | §M 1259–1261 vs §E 447–449 | Hasil sama (ADMIN) tapi model otorisasi berbeda (role statis vs policy) — panel tidak boleh asumsikan role ADMIN dari kunci capability | Kontrak |
| C22 | 429: dua rezim rate limit, satu kode — Nginx (100r/s, 10r/m refresh) / WebSocket (120/menit) vs auth 5/60s + `Retry-After`; keduanya `TOO_MANY_REQUESTS` | §2 55 vs §L 1224–1227 | UI tidak bisa bedakan sumber limit dari kode saja (hanya `Retry-After` pada auth yang membedakan) | Minor |

## 15. Keputusan yang masih perlu Fathur / Muse

| # | Keputusan | Pilihan | Rekomendasi (koordinator) |
|---|---|---|---|
| D-1 | **Gerbang password mengikuti dokumen atau premis?** Dokumen: flag + `403 PASSWORD_ROTATION_REQUIRED`; premis tugas E20: `401 PASSWORD_CHANGE_REQUIRED` (tidak ada di dokumen, kontradiksi C15) | (a) Ikuti dokumen (flag + 403); (b) minta backend tetapkan 401 | **(a)** — dokumen adalah sumber kebenaran baru; premis 401 tidak berdasar. Perlu konfirmasi Fathur karena menyimpang dari premis tugas |
| D-2 | **Bentuk kanon `/auth/me`** (kontradiksi C3): flat §L, nested §3.4 (`access.*`), atau ringkas §6B | (a) Terima ketiganya (panel baca `access.*` + flat, toleran); (b) minta backend tetapkan satu kanon | **(a) sementara, (b) paralel** — panel toleran terhadap ketiganya (sudah setengah jalan), backend tetapkan kanon di dokumen |
| D-3 | **Daftar atribut ABAC** (kontradiksi C11): whitelist 10 atribut tidak dienumerasi; contoh `subject.line_id` vs 10 nama camelCase panel | (a) Minta daftar dari spec 032/024 lengkap; (b) panel pakai contoh dokumen (dotted snake_case) | **(a)** — jangan tebak; validator panel saat ini tidak dapat dibuktikan benar/salah |
| D-4 | **`OFFLINE` nilai item atau hanya filter?** (kontradiksi C12) | (a) Nilai item sah (panel tampilkan apa adanya, tanpa normalisasi ke `UNCONFIGURED`); (b) hanya nilai filter | **(a)** — filter query yang mencantumkannya menyiratkan server mengenal nilai itu; normalisasi panel saat ini menghapus informasi |
| D-5 | **Nasib register manual legacy `POST /devices`** setelah provision kanonis ada (dok: "legacy/deprecated — dipertahankan untuk masa transisi"; aturan E18: tanpa deprecated tersisa) | (a) Pertahankan dengan label legacy di UI; (b) hapus modal register begitu provision jalan | **(a)** — dokumen sendiri mempertahankannya untuk transisi; hapus hanya bila backend mengumumkan akhir transisi |
| D-6 | **Otorisasi cancel WO** (kontradiksi C8): ADMIN vs OPERATOR+ | (a) ADMIN LAN only (§C.6); (b) OPERATOR+ LAN (§7H) | **(a)** — §C.6 adalah spesifikasi endpoint; §7H tabel ringkas. Minta backend konfirmasi |
| D-7 | **Mutasi operators** (kontradiksi C16): ADMIN vs ADMIN/SUPERVISOR | (a) ADMIN (§H header); (b) ADMIN/SUPERVISOR (per-endpoint) | **(b)** — tiga item endpoint sepakat ADMIN/SUPERVISOR; header kemungkinan generik. Minta backend konfirmasi |
| D-8 | **`oeePct` saat `performancePct` null** (kontradiksi C14) | (a) `null` (unknown, bukan 0); (b) 0 | **(a)** — konsisten dengan aturan null dokumen (§K 1163, 1194); 0 = klaim palsu "OEE nol" |
| D-9 | **Kode 404 mesin tanpa device** (kontradiksi C9): `MACHINE_NOT_BOUND` vs `NOT_FOUND` | (a) `MACHINE_NOT_BOUND`; (b) `NOT_FOUND` | **(a)** — kode spesifik lebih berguna; §Q intro. Minta backend konfirmasi |
| D-10 | **PUT /policies: `resource_pattern` atau `resourcePattern`?** (kontradiksi C4) | (a) Hanya camelCase; (b) server terima keduanya | **(a)** — kanon §3.4 eksplisit "tidak ada alias"; baris tabel kemungkinan sisa lama |
| D-11 | **§M dibersihkan backend atau panel abaikan?** (kontradiksi C1/C5): §M masih mendokumentasikan `/clients/provision` sebagai live | (a) Backend bersihkan §M; (b) panel abaikan §M, ikuti §E.3a | **(b) untuk panel + (a) diminta ke backend** — panel sudah diputuskan K-11; §M adalah sisa lama |
| D-12 | **Parameter tak dikenal di endpoint selain `/system/audit`** (kontradiksi C17): amankah `machine_id`/`event_type` dikirim ke endpoint global/export? | (a) Bersihkan pengiriman (hanya kirim parameter terdaftar); (b) andalkan klausul abaikan global | **(a)** — kirim hanya yang terdaftar; paling aman tanpa konfirmasi backend |
| D-13 | **Pemetaan guard ekspor** (kontradiksi C18): kunci capability per endpoint ekspor | (a) `audit/export` → `access_control.read`, `op-events/export` → `telemetry.refresh`; (b) satu kunci gabungan | **(a)** — ikuti guard dokumen per endpoint; kunci karangan `export.telemetry` dihapus |
| D-14 | **Nilai boolean `must_change_password` terredaksi** (kontradiksi C20) | Merujuk sumber dokumen asli sebelum implementasi A1 | **Wajib** — implementasi gerbang tidak boleh menebak nilai dari salinan terredaksi |

**Tidak perlu keputusan (sudah diputuskan, tinggal implementasi):** K-11 (provision → `POST /devices/provision`); P-I (`GET /health/detail` tidak terblokir); D1–D5+D7 scope; satu alur kanonis tanpa deprecated (E18); `severity` tidak didukung (hapus); `reason` hanya di audit IAM; `privilege_level`/`policy_count` tanpa default; `roles` satu-satunya nama field; lockout hanya server 5/60 + `Retry-After`; body tulis camelCase tanpa alias; enum `event_type` 32 nilai + pola; FSM 6 nilai; `count` = jumlah baris halaman; `POST /backups` tidak ada; `POST /permissions` didukung + guard (K-09 E18).

## 16. Catatan akhir

- **Batas riset:** diff ini membandingkan panel terhadap salinan dokumen `pasted-text.txt` (2100 baris). Bila salinan dan dokumen asli berbeda (lihat C20 — nilai terredaksi), dokumen asli menang. Tidak ada kode yang diubah dalam riset ini; tidak ada commit/push.
- **Demo bukan bukti:** banyak perilaku demo (filter lokal severity/`acknowledged`, guard demo, seed fabrikasi) berbeda dari Real — acceptance tiap perubahan di atas harus diuji melawan backend sungguhan, bukan Demo (prinsip yang sama dengan AUDIT.md §4).
- **Urutan implementasi yang disarankan (di luar P20.1, untuk epic implementasi):** (1) provision kanonis + hapus cabang lama (D1/D2 — dampak terbesar, satu alur); (2) gerbang `mustChangePassword` + hapus lockout lokal + `Retry-After` (A1–A3); (3) tulis IAM camelCase + `roles` + kunci capability kanonis (I1–I13); (4) mapper op-events + enum 32 + hapus severity (O1–O3); (5) `health/detail` + hapus sintesis (H1–H2); (6) null `*Pct` + `mapDevice` + `mapWorkOrder` (T1–T4, D7, W6–W7); (7) ekspor system-audit + filter builder (O4, O9–O10); (8) WS event names + 204/error-code fallback + apply/rollback 202.

## 17. Keputusan D-1–D-14 — 19 November 2026 (mengikuti api_docs, P20.7)

Fathur (19 Nov 2026): "ikuti api_docs dulu". Keputusan §15 diputuskan mengikuti
api_docs terupdate sebagai sumber kebenaran; rinciannya di
`docs/API_SYNC_REVIEW.md` §1 (keputusan) dan §2 (perlu ditinjau kembali backend):

- **D-1** (a) — flag + `403 PASSWORD_ROTATION_REQUIRED`; 401 tidak ada di dokumen.
- **D-2** (a) sementara + (b) paralel — panel toleran 3 bentuk `/auth/me`; backend tetapkan satu kanon.
- **D-3** (a) — minta daftar atribut ABAC dari spec 032/024; panel tidak menebak.
- **D-4** (a) — `OFFLINE` nilai item sah.
- **D-5** (a) — legacy `POST /devices` dipertahankan berlabel legacy.
- **D-6** (a) — cancel WO ADMIN LAN only.
- **D-7** (b) — mutasi operators ADMIN/SUPERVISOR.
- **D-8** (a) — `oeePct` null saat Performance null.
- **D-9** (a) — `MACHINE_NOT_BOUND`.
- **D-10** (a) — PUT /policies camelCase saja.
- **D-11** (b) + (a) — panel abaikan §M, ikuti §E.3a; minta backend bersihkan §M.
- **D-12** (a) — hanya kirim parameter terdaftar.
- **D-13** (a) — guard ekspor per endpoint.
- **D-14** — semantik flag jelas dari konteks kalimat; implementasi jalan.

Gaps doc lama diarsipkan ke `docs/archive/BACKEND_GAPS_SYSTEM_ADMIN.md` (P20.7).

## 18. Pembaruan api_docs — 19 November 2026, 09:23 WIB (P20.7 lanjutan)

Fathur mengirim koreksi api_docs di tengah implementasi E20 (bukan dokumen baru
— amandemen atas salinan yang sama):

- **Dispatch WO** — otorisasi menjadi `authorize("dispatch", "work_order")`
  (OPERATOR/SUPERVISOR/ADMIN). HMI-only; panel tetap tidak mengekspos dispatch.
- **Cancel WO** — otorisasi menjadi `authorize("cancel", "work_order")`
  (ADMIN). **D-6 TERKONFIRMASI, R-3 tertutup.** Kunci capability
  `cancel:work_order` masuk katalog kanonis (Batch 2).
- **POST /machines** — otorisasi menjadi `authorize("create", "machine")`
  (ADMIN LAN only). Kunci `create:machine` masuk katalog (Batch 2).
- **Dynsec §M** — baca = `authorize("read", "mqtt_admin")`, mutasi =
  `authorize("manage", "mqtt_admin")`. Kunci `read:mqtt_admin` /
  `manage:mqtt_admin` masuk katalog (Batch 2).
- **Contoh cURL provisioning §M** — `/clients/provision` → `/clients`.
  **R-9 tertutup sebagian di dokumen** (contoh diperbaiki; heading §M masih
  mendokumentasikan provisioning via `POST /clients {deviceId, access,...}`
  yang tetap usang vs §E.3a — panel tetap ikuti §E.3a per D-11).
- **Endpoint BARU — `GET /api/v1/system/access-mode`** → 200 `{mode:
  "private"|"public", channel: "lan"|"tunnel"|"unknown", mutations_allowed:
  boolean}`, JWT wajib (tanpa token → 401). Dipakai panel untuk menentukan UI
  read-only vs read-write. **Masuk cakupan Batch 4 (P20.5):** registry +
  transport + demo + wiring UI (prefer nilai server di mode Real, fallback ke
  derivasi env+kanal; demo mengembalikan nilai turunan env). Ini endpoint yang
  diminta dokumen backend requirements access-mode — A10.2 secara keseluruhan
  BELUM terbuka (middleware enforcement server-side masih menunggu backend);
  yang dikerjakan hanya konsumsi sisi panel.
