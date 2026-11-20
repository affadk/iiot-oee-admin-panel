import test from 'node:test';
import assert from 'node:assert/strict';
import { apiClient, store } from '../services/api/client';

function resetToAdminLan() {
  apiClient.setNetworkMode('LAN');
  apiClient.setUserRole('ADMIN');
  apiClient.setSessionActive(true);
}

test('Test A — Role Management: CRUD custom roles, system role protection, and ROLE_IN_USE conflict', async () => {
  resetToAdminLan();
  const prevVersion = store.iamInfo.authzVersion;

  // 1. List roles — tanpa privilege_level / policy_count (§3.4, X7)
  const roles = await apiClient.getIamRoles();
  assert.ok(roles.length >= 5);
  const adminRole = roles.find((r) => r.name === 'ADMIN');
  assert.ok(adminRole?.is_system);
  assert.equal('privilege_level' in (adminRole ?? {}), false);
  assert.equal('policy_count' in (adminRole ?? {}), false);

  // 2. Reject invalid role name, reserved ADMIN name, and duplicate name
  await assert.rejects(
    () =>
      apiClient.createIamRole({
        name: 'invalid role!',
        description: 'Bad name',
      }),
    (err: any) => err.httpStatus === 400 && err.code === 'VALIDATION_ERROR'
  );
  await assert.rejects(
    () =>
      apiClient.createIamRole({
        name: 'ADMIN',
        description: 'Reserved immutable name',
      }),
    (err: any) => err.httpStatus === 403 && err.code === 'FORBIDDEN'
  );
  await assert.rejects(
    () =>
      apiClient.createIamRole({
        name: 'quality_auditor',
        description: 'Case-insensitive duplicate custom role',
      }),
    (err: any) => err.httpStatus === 409 && err.code === 'CONFLICT'
  );

  // 3. Create custom role QA_INSPECTOR (tanpa privilege_level)
  const qaRole = await apiClient.createIamRole({
    name: 'QA_INSPECTOR',
    description: 'Inspektor kualitas shift lantai produksi',
  });
  assert.equal(qaRole.name, 'QA_INSPECTOR');
  assert.equal(qaRole.is_system, false);
  assert.equal('privilege_level' in qaRole, false);
  assert.equal(store.iamInfo.authzVersion, prevVersion + 1);

  // 4. Update custom role description
  const updatedQa = await apiClient.updateIamRole(qaRole.id, {
    description: 'Inspektor kualitas lini perakitan & CNC',
  });
  assert.equal(updatedQa.description, 'Inspektor kualitas lini perakitan & CNC');

  // 5. Hanya ADMIN immutable (403 ROLE_IMMUTABLE); preset lain boleh
  // diubah/dihapus bila tidak dipakai — di sini masih ter-assign → 409.
  await assert.rejects(
    () => apiClient.updateIamRole('role-admin', { description: 'Tamper ADMIN role' }),
    (err: any) => err.httpStatus === 403 && err.code === 'ROLE_IMMUTABLE'
  );
  await assert.rejects(
    () => apiClient.deleteIamRole('role-admin'),
    (err: any) => err.httpStatus === 403 && err.code === 'ROLE_IMMUTABLE'
  );
  for (const presetId of ['role-supervisor', 'role-operator', 'role-maintenance']) {
    await assert.rejects(
      () => apiClient.deleteIamRole(presetId),
      (err: any) => err.httpStatus === 409 && err.code === 'ROLE_IN_USE'
    );
  }
  // Update preset yang tidak dipakai di seed? SUPERVISOR ter-assign tapi
  // update deskripsi diizinkan (bukan immutable) — kembalikan setelahnya.
  const supBefore = (await apiClient.getIamRoles()).find((r) => r.id === 'role-supervisor');
  const supUpdated = await apiClient.updateIamRole('role-supervisor', { description: 'Temp description' });
  assert.equal(supUpdated.description, 'Temp description');
  await apiClient.updateIamRole('role-supervisor', { description: supBefore?.description ?? '' });

  // 6. Block deleting custom role while still assigned to a user (409 ROLE_IN_USE)
  const asg = await apiClient.assignIamUserRole({
    operatorId: 'OP-115',
    roleName: 'QA_INSPECTOR',
    scopeType: 'LINE',
    scopeId: 'LINE-01',
  });
  await apiClient.addIamRolePermission(qaRole.id, 'perm-22', {
    resourcePattern: 'telemetry:*',
    effect: 'ALLOW',
  });
  await assert.rejects(
    () => apiClient.deleteIamRole(qaRole.id),
    (err: any) => err.httpStatus === 409 && err.code === 'ROLE_IN_USE'
  );

  // 7. Revoke assignment; role masih punya policy → 409 ROLE_IN_USE
  // (policy TIDAK dihapus diam-diam). Lepas binding dulu, baru hapus role.
  await apiClient.revokeIamUserRole({
    id: asg.id,
    operatorId: 'OP-115',
    roleName: 'QA_INSPECTOR',
    scopeType: 'LINE',
    scopeId: 'LINE-01',
  });
  await assert.rejects(
    () => apiClient.deleteIamRole(qaRole.id),
    (err: any) => err.httpStatus === 409 && err.code === 'ROLE_IN_USE'
  );
  await apiClient.removeIamRolePermission(qaRole.id, 'perm-22');
  const delRes = await apiClient.deleteIamRole(qaRole.id);
  assert.equal(delRes.success, true);
  assert.equal(store.iamRoles.some((r) => r.id === qaRole.id), false);
  assert.equal(store.iamPolicies.some((p) => p.roleId === qaRole.id), false);
});

test('Test B — Role Permission Management: fixed catalog, duplicate/reserved/wildcard guards, anti-lockout & policy sync', async () => {
  resetToAdminLan();
  const catalog = await apiClient.getIamPermissions();
  // 22 awal + 7 master data (device, production_line, shift, shift_schedule
  // read+manage — domain berjaga per API doc auth/me, FR-032-40/42)
  // + 1 (E20 P20.5: perm-30 create:machine, pembaruan 09:23).
  assert.equal(catalog.length, 30);

  // 1. Permission CREATE diizinkan dengan guard: pasangan tanpa rute
  // penjaga → 400 INERT_PERMISSION; pasangan terjaga baru → dibuat.
  await assert.rejects(
    () =>
      apiClient.createIamPermission({
        action: 'custom',
        resourceType: 'telemetry',
        description: 'No guard route for this pair',
      }),
    (err: any) => err.httpStatus === 400 && err.code === 'INERT_PERMISSION'
  );
  const newPerm = await apiClient.createIamPermission({
    action: 'read',
    resourceType: 'quality',
    description: 'Melihat analitik kualitas',
  });
  assert.equal(newPerm.action, 'read');
  assert.equal(newPerm.resourceType, 'quality');
  await assert.rejects(
    () =>
      apiClient.createIamPermission({
        action: 'read',
        resourceType: 'quality',
        description: 'Duplicate pair',
      }),
    (err: any) => err.httpStatus === 409 && err.code === 'PERMISSION_EXISTS'
  );

  // 2. Assign non-reserved permission to custom role & block duplicate
  const role = await apiClient.createIamRole({
    name: 'PERM_TEST_ROLE',
    description: 'Role untuk pengujian permission binding',
  });
  try {
    await apiClient.addIamRolePermission(role.id, 'perm-22', {
      resourcePattern: 'telemetry:*',
      effect: 'ALLOW',
    });
    await assert.rejects(
      () =>
        apiClient.addIamRolePermission(role.id, 'perm-22', {
          resourcePattern: 'telemetry:*',
          effect: 'ALLOW',
        }),
      (err: any) => err.httpStatus === 409 && err.code === 'DUPLICATE_ROLE_PERMISSION'
    );

    // 3. Block all 4 reserved permissions & wildcard resource patterns on custom roles
    for (const reservedPermId of ['perm-07', 'perm-08', 'perm-09', 'perm-10']) {
      await assert.rejects(
        () => apiClient.addIamRolePermission(role.id, reservedPermId),
        (err: any) => err.httpStatus === 403 && err.code === 'PRIVILEGE_ESCALATION_DENIED'
      );
    }
    await assert.rejects(
      () =>
        apiClient.addIamRolePermission(role.id, 'perm-06', {
          resourcePattern: '*',
          effect: 'ALLOW',
        }),
      (err: any) => err.httpStatus === 403 && err.code === 'PRIVILEGE_ESCALATION_DENIED'
    );

    // 4. Anti-lockout guards for ADMIN
    await assert.rejects(
      () =>
        apiClient.addIamRolePermission('role-admin', 'perm-10', {
          resourcePattern: 'access_control:*',
          effect: 'DENY',
        }),
      (err: any) => err.httpStatus === 403 && err.code === 'FORBIDDEN'
    );
    await assert.rejects(
      () => apiClient.removeIamRolePermission('role-admin', 'perm-10'),
      (err: any) => err.httpStatus === 403 && err.code === 'FORBIDDEN'
    );
    await assert.rejects(
      () => apiClient.deleteIamPolicy('pol-01'),
      (err: any) => err.httpStatus === 403 && err.code === 'FORBIDDEN'
    );

    // 5. Revoke permission & verify audit log
    await apiClient.removeIamRolePermission(role.id, 'perm-22');
    const latestAudit = store.auditLogs[0];
    assert.equal(latestAudit.event_type, 'MASTER_DATA_MUTATION');
    assert.match(latestAudit.description, /perm-22/);
    assert.equal(store.iamPolicies.some((p) => p.roleId === role.id && p.permissionId === 'perm-22'), false);
  } finally {
    await apiClient.deleteIamRole(role.id);
  }
});

test('Test C — User Management & Role Assignment: auth password verification, suspend lockout, multi-role scope, cascade delete & stale token', async () => {
  resetToAdminLan();

  // 1. Create operator with real password
  const created = await apiClient.createOperator({
    operator_id: 'OP-888',
    name: 'Dewi Anggraini',
    role: 'OPERATOR',
    line_id: 'LINE-02',
    password: 'SecretUserPass88!',
    is_active: true,
  });
  assert.equal(created.operator_id, 'OP-888');

  // 2. Wrong password rejected (401), right password succeeds
  await assert.rejects(
    () => apiClient.login('OP-888', 'WrongPassword!'),
    (err: any) => err.httpStatus === 401 && err.code === 'UNAUTHORIZED'
  );
  const loginRes = await apiClient.login('OP-888', 'SecretUserPass88!');
  assert.equal(loginRes.operator.id, 'OP-888');
  assert.equal(loginRes.operator.line_id, 'LINE-02');

  // 3. Switch back to ADM-001, suspend OP-888 and verify active session fails 401 + login fails 401
  resetToAdminLan();
  await apiClient.toggleOperatorStatus('OP-888', false);
  store.currentUserId = 'OP-888';
  store.currentUserRole = 'OPERATOR';
  store.isAuthenticated = true;
  store.tokenAuthzVersion = store.iamInfo.authzVersion;
  await assert.rejects(
    () => apiClient.getAuthMe(),
    (err: any) => err.httpStatus === 401 && err.code === 'SUBJECT_INACTIVE'
  );
  await assert.rejects(
    () => apiClient.login('OP-888', 'SecretUserPass88!'),
    (err: any) => err.httpStatus === 401 && err.code === 'UNAUTHORIZED'
  );

  // 4. Reactivate, update info, assign multiple roles & test duplicate/scope rules
  resetToAdminLan();
  await apiClient.toggleOperatorStatus('OP-888', true);
  const updated = await apiClient.updateOperator('OP-888', { name: 'Dewi Anggraini Senior', line_id: 'LINE-01' });
  assert.equal(updated.name, 'Dewi Anggraini Senior');
  assert.equal(updated.line_id, 'LINE-01');

  const asgOrg = await apiClient.assignIamUserRole({
    operatorId: 'OP-888',
    roleName: 'QUALITY_AUDITOR',
    scopeType: 'ORGANIZATION',
  });
  const asgLine = await apiClient.assignIamUserRole({
    operatorId: 'OP-888',
    roleName: 'OPERATOR',
    scopeType: 'LINE',
    scopeId: 'LINE-01',
  });
  assert.equal(asgOrg.scope_type, 'ORGANIZATION');
  assert.equal(asgLine.scope_type, 'LINE');

  // Reject duplicate assignment (409 DUPLICATE_USER_ROLE)
  await assert.rejects(
    () =>
      apiClient.assignIamUserRole({
        operatorId: 'OP-888',
        roleName: 'QUALITY_AUDITOR',
        scopeType: 'ORGANIZATION',
      }),
    (err: any) => err.httpStatus === 409 && err.code === 'DUPLICATE_USER_ROLE'
  );

  // Reject revoking ADMIN from ADM-001 (403 PROTECTED_ACCOUNT)
  await assert.rejects(
    () =>
      apiClient.revokeIamUserRole({
        operatorId: 'ADM-001',
        roleName: 'ADMIN',
        scopeType: 'ORGANIZATION',
      }),
    (err: any) => err.httpStatus === 403 && err.code === 'PROTECTED_ACCOUNT'
  );

  // 5. Inspect effective permissions
  const eff = await apiClient.getSubjectEffectivePermissions('OP-888');
  assert.equal(eff.roles.length, 2);
  assert.equal(eff.isActive, true);
  assert.equal(eff.authzVersion, store.iamInfo.authzVersion);

  // 6. Delete operator -> cascade removes iamAssignments & password
  await apiClient.deleteOperator('OP-888');
  assert.equal(store.iamAssignments.some((a) => a.operator_id === 'OP-888'), false);
  assert.equal(store.operatorPasswords.has('OP-888'), false);
});

test('Test D — Full 13-Step End-to-End Integration: custom role -> permissions -> user -> login -> execute -> revoke -> stale 401 -> re-login', async () => {
  resetToAdminLan();
  const prevMode = store.iamInfo.mode;
  apiClient.setIamMode('enforce');

  let pmRoleId = '';
  try {
    // Step 1: Create custom role PRODUCTION_MANAGER
    const pmRole = await apiClient.createIamRole({
      name: 'PRODUCTION_MANAGER',
      description: 'Manajer produksi lintas lini dengan izin ekspor & ack',
    });
    pmRoleId = pmRole.id;

    // Step 2: Assign permissions (perm-22 read:telemetry, perm-06 refresh:telemetry, perm-12 ack:operational_events, perm-05 classify:downtime)
    await apiClient.addIamRolePermission(pmRole.id, 'perm-22', { resourcePattern: 'telemetry:*', effect: 'ALLOW' });
    await apiClient.addIamRolePermission(pmRole.id, 'perm-06', { resourcePattern: 'telemetry:*', effect: 'ALLOW' });
    await apiClient.addIamRolePermission(pmRole.id, 'perm-12', { resourcePattern: 'operational_event:*', effect: 'ALLOW' });
    await apiClient.addIamRolePermission(pmRole.id, 'perm-05', { resourcePattern: 'downtime_event:*', effect: 'ALLOW' });

    // Step 3: Verify reserved permissions cannot be assigned (403)
    await assert.rejects(
      () => apiClient.addIamRolePermission(pmRole.id, 'perm-10', { resourcePattern: 'access_control:*' }),
      (err: any) => err.httpStatus === 403 && err.code === 'PRIVILEGE_ESCALATION_DENIED'
    );

    // Step 4: Create user OP-777
    await apiClient.createOperator({
      operator_id: 'OP-777',
      name: 'Bambang Sutrisno',
      role: 'OPERATOR',
      line_id: 'LINE-01',
      password: 'ProdMgrPass1!',
      is_active: true,
    });

    // Step 5: Assign PRODUCTION_MANAGER (ORGANIZATION scope) to OP-777
    await apiClient.assignIamUserRole({
      operatorId: 'OP-777',
      roleName: 'PRODUCTION_MANAGER',
      scopeType: 'ORGANIZATION',
    });

    // Step 6: Login as OP-777 & inspect GET /api/v1/auth/me
    const loginRes = await apiClient.login('OP-777', 'ProdMgrPass1!');
    assert.equal(loginRes.operator.id, 'OP-777');
    const me = await apiClient.getAuthMe();
    assert.ok(me.effectiveRoles.some((r) => r.roleName === 'PRODUCTION_MANAGER' && r.scopeType === 'ORGANIZATION'));
    assert.equal(me.capabilities['telemetry.refresh'], 'allow');
    assert.equal(me.capabilities['telemetry.reconciliation.refresh'], 'unknown');
    assert.equal(me.capabilities['access_control.manage'], 'deny');
    assert.equal(me.capabilities['product.manage'], 'deny');

    // Step 7: Execute permitted endpoints -> succeed
    const nowIso = new Date().toISOString();
    const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const expRes = await apiClient.exportTelemetryData({
      device_id: 'STM32-OEE-01',
      from: dayAgoIso,
      to: nowIso,
      format: 'csv',
    });
    assert.ok(expRes.rowCount > 0);
    const recRes = await apiClient.triggerReconciliationRefresh({ startWindow: dayAgoIso, endWindow: nowIso });
    assert.equal(recRes.success, true);

    const events = await apiClient.getOperationalEvents();
    const targetEv = events.find((e) => !e.acknowledged) ?? events[0];
    const ackRes = await apiClient.acknowledgeOperationalEvent(targetEv.id, 'Reviewed by Production Manager');
    assert.equal(ackRes.acknowledged, true);

    const dtRes = await apiClient.classifyDowntimeReason('dt-ev-05', 'PLANNED_MAINTENANCE', 'Scheduled tooling audit');
    // E20 P20.5 (FAT-157): classify mengembalikan DowntimeReasonResult (§J.3).
    assert.equal(dtRes.success, true);
    assert.equal(dtRes.eventId, 'dt-ev-05');
    assert.equal(dtRes.operatorReason, 'Scheduled tooling audit');

    // Step 8: Execute forbidden endpoints -> fail 403
    await assert.rejects(
      () => apiClient.getIamRoles(),
      (err: any) => err.httpStatus === 403 && err.code === 'FORBIDDEN'
    );
    await assert.rejects(
      () =>
        apiClient.createProduct({
          product_id: 'PRD-FORBID-777',
          name: 'Forbidden Product',
          ideal_cycle_time_seconds: 10,
        }),
      (err: any) => err.httpStatus === 403 && err.code === 'FORBIDDEN'
    );
    await assert.rejects(
      () => apiClient.cancelWorkOrder('WO-2026-103', 'Unauthorized cancel test'),
      (err: any) => err.httpStatus === 403 && err.code === 'FORBIDDEN'
    );

    // Step 9: Switch back to ADM-001, revoke refresh:telemetry (perm-06) from PRODUCTION_MANAGER
    const staleVersion = store.iamInfo.authzVersion;
    resetToAdminLan();
    await apiClient.removeIamRolePermission(pmRole.id, 'perm-06');

    // Step 10: Verify OP-777's old token rejects with 401 AUTHZ_VERSION_STALE
    store.currentUserId = 'OP-777';
    store.currentUserName = 'Bambang Sutrisno';
    store.currentUserRole = 'OPERATOR';
    store.currentUserLineId = 'LINE-01';
    store.isAuthenticated = true;
    store.authToken = loginRes.token;
    store.tokenAuthzVersion = staleVersion;

    await assert.rejects(
      () => apiClient.getAuthMe(),
      (err: any) => err.httpStatus === 401 && err.code === 'AUTHZ_STALE'
    );

    // Step 11: Re-login OP-777, verify exportTelemetryData & triggerReconciliationRefresh now fail 403, while ack still succeeds
    const reLogin = await apiClient.login('OP-777', 'ProdMgrPass1!');
    assert.ok(store.iamInfo.authzVersion > staleVersion);
    const meAfterRevoke = await apiClient.getAuthMe();
    assert.equal(meAfterRevoke.capabilities['telemetry.refresh'], 'deny');
    assert.equal(meAfterRevoke.capabilities['telemetry.reconciliation.refresh'], 'deny');

    await assert.rejects(
      () =>
        apiClient.exportTelemetryData({
          device_id: 'STM32-OEE-01',
          from: dayAgoIso,
          to: nowIso,
          format: 'csv',
        }),
      (err: any) => err.httpStatus === 403 && err.code === 'FORBIDDEN'
    );
    await assert.rejects(
      () => apiClient.triggerReconciliationRefresh({}),
      (err: any) => err.httpStatus === 403 && err.code === 'FORBIDDEN'
    );

    const ackStillWorks = await apiClient.acknowledgeOperationalEvent(targetEv.id, 'Still authorized for ack');
    assert.equal(ackStillWorks.acknowledged, true);
  } finally {
    // Step 12: Clean up restoring clean store state — lepas semua
    // binding policy dulu (delete role menolak bila masih punya policy).
    resetToAdminLan();
    if (store.operators.some((o) => o.operator_id === 'OP-777')) {
      await apiClient.deleteOperator('OP-777');
    }
    if (pmRoleId && store.iamRoles.some((r) => r.id === pmRoleId)) {
      for (const permId of ['perm-22', 'perm-12', 'perm-05']) {
        await apiClient.removeIamRolePermission(pmRoleId, permId);
      }
      await apiClient.deleteIamRole(pmRoleId);
    }
    apiClient.setIamMode(prevMode);
  }
});
