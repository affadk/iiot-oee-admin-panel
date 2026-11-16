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

  // 1. List roles & inspect policy_count
  const roles = await apiClient.getIamRoles();
  assert.ok(roles.length >= 5);
  const adminRole = roles.find((r) => r.name === 'ADMIN');
  assert.ok(adminRole?.is_system);
  assert.ok((adminRole?.policy_count ?? 0) >= 1);

  // 2. Reject invalid role name, privilege level >= 30, and duplicate name
  await assert.rejects(
    () =>
      apiClient.createIamRole({
        name: 'invalid role!',
        privilege_level: 20,
        description: 'Bad name',
      }),
    (err: any) => err.httpStatus === 400 && err.code === 'VALIDATION_ERROR'
  );
  await assert.rejects(
    () =>
      apiClient.createIamRole({
        name: 'OVER_LEVEL',
        privilege_level: 30,
        description: 'Exceeds custom role ceiling 29',
      }),
    (err: any) => err.httpStatus === 400 && err.code === 'VALIDATION_ERROR'
  );
  await assert.rejects(
    () =>
      apiClient.createIamRole({
        name: 'ADMIN',
        privilege_level: 20,
        description: 'System role collision',
      }),
    (err: any) => err.httpStatus === 403 && err.code === 'FORBIDDEN'
  );
  await assert.rejects(
    () =>
      apiClient.createIamRole({
        name: 'quality_auditor',
        privilege_level: 20,
        description: 'Case-insensitive duplicate custom role',
      }),
    (err: any) => err.httpStatus === 409 && err.code === 'CONFLICT'
  );

  // 3. Create custom role QA_INSPECTOR
  const qaRole = await apiClient.createIamRole({
    name: 'QA_INSPECTOR',
    privilege_level: 20,
    description: 'Inspektor kualitas shift lantai produksi',
  });
  assert.equal(qaRole.name, 'QA_INSPECTOR');
  assert.equal(qaRole.is_system, false);
  assert.equal(qaRole.privilege_level, 20);
  assert.equal(store.iamInfo.authzVersion, prevVersion + 1);

  // 4. Update custom role description & privilege_level
  const updatedQa = await apiClient.updateIamRole(qaRole.id, {
    description: 'Inspektor kualitas lini perakitan & CNC',
    privilege_level: 22,
  });
  assert.equal(updatedQa.description, 'Inspektor kualitas lini perakitan & CNC');
  assert.equal(updatedQa.privilege_level, 22);

  // 5. Block updating/deleting all 4 system roles
  for (const sysId of ['role-admin', 'role-supervisor', 'role-operator', 'role-maintenance']) {
    await assert.rejects(
      () => apiClient.updateIamRole(sysId, { description: 'Tamper system role' }),
      (err: any) => err.httpStatus === 403 && err.code === 'SYSTEM_ROLE_PROTECTED'
    );
    await assert.rejects(
      () => apiClient.deleteIamRole(sysId),
      (err: any) => err.httpStatus === 403 && err.code === 'FORBIDDEN'
    );
  }

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

  // 7. Revoke assignment, then delete unused custom role and verify orphaned policies removed
  await apiClient.revokeIamUserRole({
    id: asg.id,
    operatorId: 'OP-115',
    roleName: 'QA_INSPECTOR',
    scopeType: 'LINE',
    scopeId: 'LINE-01',
  });
  const delRes = await apiClient.deleteIamRole(qaRole.id);
  assert.equal(delRes.success, true);
  assert.equal(store.iamRoles.some((r) => r.id === qaRole.id), false);
  assert.equal(store.iamPolicies.some((p) => p.role_id === qaRole.id || p.role === 'QA_INSPECTOR'), false);
});

test('Test B — Role Permission Management: fixed catalog, duplicate/reserved/wildcard guards, anti-lockout & policy sync', async () => {
  resetToAdminLan();
  const catalog = await apiClient.getIamPermissions();
  // 22 awal + 7 master data (device, production_line, shift, shift_schedule
  // read+manage — domain berjaga per API doc auth/me, FR-032-40/42).
  assert.equal(catalog.length, 29);

  // 1. Permission Catalog CREATE strictly forbidden
  await assert.rejects(
    () =>
      apiClient.createIamPermission({
        action: 'custom',
        resource_type: 'telemetry',
        description: 'Cannot mutate catalog',
      }),
    (err: any) => err.httpStatus === 403 && err.code === 'PERMISSION_CATALOG_READ_ONLY'
  );

  // 2. Assign non-reserved permission to custom role & block duplicate
  const role = await apiClient.createIamRole({
    name: 'PERM_TEST_ROLE',
    privilege_level: 18,
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
    assert.equal(latestAudit.action, 'REMOVE_ROLE_PERMISSION');
    assert.equal(latestAudit.resource_id, role.id);
    assert.equal(store.iamPolicies.some((p) => p.role_id === role.id && p.permission_id === 'perm-22'), false);
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
  const loginRes = await apiClient.login('OP-888', 'SecretUserPass88!', 'HMI-L2');
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
    (err: any) => err.httpStatus === 401 && err.code === 'UNAUTHORIZED'
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
  assert.equal(eff.effectiveRoles.length, 2);

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
    // Step 1: Create custom role PRODUCTION_MANAGER (level 28)
    const pmRole = await apiClient.createIamRole({
      name: 'PRODUCTION_MANAGER',
      privilege_level: 28,
      description: 'Manajer produksi lintas lini dengan izin ekspor & ack',
    });
    pmRoleId = pmRole.id;

    // Step 2: Assign permissions (perm-22 read:telemetry, perm-06 refresh:telemetry, perm-12 ack:operational_events, perm-05 classify:downtime)
    await apiClient.addIamRolePermission(pmRole.id, 'perm-22', { resourcePattern: 'telemetry:*', effect: 'ALLOW' });
    await apiClient.addIamRolePermission(pmRole.id, 'perm-06', { resourcePattern: 'telemetry:*', effect: 'ALLOW' });
    await apiClient.addIamRolePermission(pmRole.id, 'perm-12', { resourcePattern: 'operational_events:*', effect: 'ALLOW' });
    await apiClient.addIamRolePermission(pmRole.id, 'perm-05', { resourcePattern: 'downtime:*', effect: 'ALLOW' });

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
    const loginRes = await apiClient.login('OP-777', 'ProdMgrPass1!', 'STN-PM');
    assert.equal(loginRes.operator.id, 'OP-777');
    const me = await apiClient.getAuthMe();
    assert.ok(me.effectiveRoles.some((r) => r.roleName === 'PRODUCTION_MANAGER' && r.scopeType === 'ORGANIZATION'));
    assert.equal(me.capabilities['export.telemetry'], 'allow');
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
    assert.equal(dtRes.category, 'PLANNED_MAINTENANCE');

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
      (err: any) => err.httpStatus === 401 && err.code === 'AUTHZ_VERSION_STALE'
    );

    // Step 11: Re-login OP-777, verify exportTelemetryData & triggerReconciliationRefresh now fail 403, while ack still succeeds
    const reLogin = await apiClient.login('OP-777', 'ProdMgrPass1!', 'STN-PM');
    assert.ok(store.iamInfo.authzVersion > staleVersion);
    const meAfterRevoke = await apiClient.getAuthMe();
    assert.equal(meAfterRevoke.capabilities['export.telemetry'], 'deny');
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
    // Step 12: Clean up restoring clean store state
    resetToAdminLan();
    if (store.operators.some((o) => o.operator_id === 'OP-777')) {
      await apiClient.deleteOperator('OP-777');
    }
    if (pmRoleId && store.iamRoles.some((r) => r.id === pmRoleId)) {
      await apiClient.deleteIamRole(pmRoleId);
    }
    apiClient.setIamMode(prevMode);
  }
});
