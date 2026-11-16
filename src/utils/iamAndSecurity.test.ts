import test from 'node:test';
import assert from 'node:assert/strict';
import { apiClient, store } from '../services/api/client';
import {
  canPerformMutation,
  canCancelWorkOrder,
  canForceReconciliationRefresh,
} from './oeeCalculations';

test('ADR-003 & Admin Boundary: HMI actuation and WO dispatch/complete methods do not exist on apiClient', () => {
  assert.equal('sendDeviceCommand' in apiClient, false);
  assert.equal('dispatchWorkOrder' in apiClient, false);
  assert.equal('completeWorkOrder' in apiClient, false);
  assert.equal('initiateWorkOrderFromZones' in apiClient, false);
  assert.equal('validateWorkOrderZone' in apiClient, false);
  assert.equal('provisionMqttEdgeDevice' in apiClient, false);
  assert.equal('getIamAssignments' in apiClient, false);
});

test('IAM anti-lockout: DENY policy on ADMIN role is strictly rejected', async () => {
  apiClient.setNetworkMode('LAN');
  apiClient.setUserRole('ADMIN');
  apiClient.setSessionActive(true);
  await assert.rejects(
    async () => {
      await apiClient.createIamPolicy({
        role: 'ADMIN',
        action: 'manage:access_control',
        resource_pattern: 'org:*',
        eft: 'DENY',
        is_active: true,
      });
    },
    {
      message: /Policy DENY pada role ADMIN dilarang/,
    }
  );
});

test('IAM anti-lockout: Disabling root ADMIN policy & revoking ADM-001 ADMIN role are rejected', async () => {
  await assert.rejects(
    async () => {
      await apiClient.toggleIamPolicy('pol-01', false);
    },
    {
      message: /Menonaktifkan atau mengubah policy ADMIN menjadi DENY dilarang/,
    }
  );

  await assert.rejects(
    async () => {
      await apiClient.revokeIamUserRole({
        operatorId: 'ADM-001',
        roleName: 'ADMIN',
        scopeType: 'ORGANIZATION',
      });
    },
    {
      message: /Role ADMIN pada ADM-001 tidak dapat dicabut/,
    }
  );
});

test('IAM privilege guards: system roles, >29 custom role ceiling, and reserved permissions are blocked', async () => {
  await assert.rejects(
    async () => {
      await apiClient.deleteIamRole('role-admin');
    },
    {
      message: /Role sistem .* dilindungi/,
    }
  );

  await assert.rejects(
    async () => {
      await apiClient.createIamRole({
        name: 'PSEUDO_ADMIN',
        privilege_level: 35,
        description: 'Should fail ceiling check',
      });
    },
    (err: any) =>
      err.httpStatus === 400 &&
      err.code === 'VALIDATION_ERROR' &&
      Array.isArray(err.issues) &&
      err.issues.some((i: any) => i.field === 'privilege_level' && /29/.test(i.message))
  );

  await assert.rejects(
    async () => {
      await apiClient.addIamRolePermission('role-quality-auditor', 'perm-10');
    },
    {
      message: /reserved permission/,
    }
  );
});

test('SUPERVISOR privilege ceiling: cannot create or toggle ADMIN/SUPERVISOR accounts', async () => {
  apiClient.setNetworkMode('LAN');
  apiClient.setUserRole('SUPERVISOR');

  await assert.rejects(
    async () => {
      await apiClient.createOperator({
        operator_id: 'SUP-999',
        name: 'Illegal Supervisor',
        role: 'SUPERVISOR',
        password: 'Password123!',
      });
    },
    {
      message: /tidak berhak membuat akun dengan peran SUPERVISOR/,
    }
  );

  await assert.rejects(
    async () => {
      await apiClient.toggleOperatorStatus('ADM-001', false);
    },
    {
      message: /tidak dapat mengubah status akun ADMIN/,
    }
  );

  apiClient.setUserRole('ADMIN');
});

test('Remote Tunnel mode disables mutations with Indonesian observation-only reason', () => {
  const remoteResult = canPerformMutation('ADMIN', 'REMOTE_TUNNEL', 'BROKER_CONFIG');
  assert.equal(remoteResult.allowed, false, 'Remote mode must disable mutations');
  assert.match(remoteResult.reason ?? '', /Mode observasi — perubahan dinonaktifkan/);

  const lanResult = canPerformMutation('ADMIN', 'LAN', 'BROKER_CONFIG');
  assert.equal(lanResult.allowed, true, 'LAN mode permits mutations for ADMIN');
});

test('RBAC guards enforce Work Order cancel and Reconciliation refresh privileges', () => {
  assert.equal(canCancelWorkOrder('ADMIN', 'LAN'), true);
  assert.equal(canCancelWorkOrder('SUPERVISOR', 'LAN'), false);
  assert.equal(canCancelWorkOrder('OPERATOR', 'LAN'), false);
  assert.equal(canCancelWorkOrder('MAINTENANCE', 'LAN'), false);
  assert.equal(canCancelWorkOrder('ADMIN', 'REMOTE_TUNNEL'), false);

  assert.equal(canForceReconciliationRefresh('ADMIN', 'LAN'), true);
  assert.equal(canForceReconciliationRefresh('SUPERVISOR', 'LAN'), true);
  assert.equal(canForceReconciliationRefresh('OPERATOR', 'LAN'), false);
  assert.equal(canForceReconciliationRefresh('MAINTENANCE', 'LAN'), false);
  assert.equal(canForceReconciliationRefresh('ADMIN', 'REMOTE_TUNNEL'), false);
});

test('Operational Event acknowledgement logs optional operator note in audit trail', async () => {
  apiClient.setNetworkMode('LAN');
  apiClient.setUserRole('SUPERVISOR');
  const events = await apiClient.getOperationalEvents();
  const target = events.find((e) => !e.acknowledged) || events[0];
  assert.ok(target, 'Expected at least one operational event');

  const updated = await apiClient.acknowledgeOperationalEvent(target.id, 'Checked coolant pump pressure');
  assert.equal(updated.acknowledged, true);
  assert.match(store.auditLogs[0].details, /Checked coolant pump pressure/);

  apiClient.setUserRole('ADMIN');
});

test('Protected accounts (is_protected) block deactivation, role downgrade, and deletion with 403 PROTECTED_ACCOUNT', async () => {
  apiClient.setNetworkMode('LAN');
  apiClient.setUserRole('ADMIN');
  apiClient.setSessionActive(true);

  await assert.rejects(
    () => apiClient.toggleOperatorStatus('ADM-001', false),
    (err: any) => err.httpStatus === 403 && err.code === 'PROTECTED_ACCOUNT'
  );
  await assert.rejects(
    () => apiClient.updateOperator('ADM-001', { role: 'OPERATOR' }),
    (err: any) => err.httpStatus === 403 && err.code === 'PROTECTED_ACCOUNT'
  );
  await assert.rejects(
    () => apiClient.deleteOperator('ADM-001'),
    (err: any) => err.httpStatus === 403 && err.code === 'PROTECTED_ACCOUNT'
  );
});

test('Reserved permissions cannot be granted to custom roles via createIamPolicy or updateIamPolicy', async () => {
  apiClient.setNetworkMode('LAN');
  apiClient.setUserRole('ADMIN');
  apiClient.setSessionActive(true);

  await assert.rejects(
    () =>
      apiClient.createIamPolicy({
        role: 'QUALITY_AUDITOR',
        action: 'manage',
        resource_pattern: 'access_control:*',
        eft: 'ALLOW',
        is_active: true,
      }),
    (err: any) => err.httpStatus === 403 && err.code === 'PRIVILEGE_ESCALATION_DENIED'
  );
});

test('Stale authz_version triggers 401 AUTHZ_VERSION_STALE and fires onUnauthorized session termination', async () => {
  apiClient.setNetworkMode('LAN');
  apiClient.setUserRole('ADMIN');
  apiClient.setSessionActive(true);

  let unauthorizedReason = '';
  apiClient.setAuthHooks({
    onUnauthorized: (reason?: string) => {
      unauthorizedReason = reason ?? '';
    },
  });

  const info = await apiClient.getIamInfo();
  apiClient.setTokenAuthzVersion(Math.max(0, info.authzVersion - 1));

  await assert.rejects(
    () => apiClient.getOperators(),
    (err: any) => err.httpStatus === 401 && err.code === 'AUTHZ_VERSION_STALE'
  );
  assert.match(unauthorizedReason, /Sesi berakhir|authz_version/i);

  // Restore healthy session & clear hooks
  apiClient.setSessionActive(true);
  apiClient.setTokenAuthzVersion(info.authzVersion);
  apiClient.setAuthHooks({});
});

test('Enforce mode DENY policy blocks SUPERVISOR action and records DENY decision in iamAuditDecisions', async () => {
  apiClient.setNetworkMode('LAN');
  apiClient.setUserRole('ADMIN');
  apiClient.setSessionActive(true);

  const prevMode = store.iamInfo.mode;
  apiClient.setIamMode('enforce');
  const denyPol = await apiClient.createIamPolicy({
    role: 'SUPERVISOR',
    action: 'refresh:telemetry',
    resource_pattern: '*',
    eft: 'DENY',
    is_active: true,
    reason: 'Temporary reconciliation freeze',
  });

  try {
    apiClient.setUserRole('SUPERVISOR');
    const supMe = await apiClient.getAuthMe();
    assert.equal(supMe.capabilities['telemetry.reconciliation.refresh'], 'deny');

    await assert.rejects(
      () => apiClient.triggerReconciliationRefresh({}),
      (err: any) => err.httpStatus === 403 && err.code === 'FORBIDDEN'
    );
    assert.equal(store.iamAuditDecisions[0]?.decision, 'DENY');
  } finally {
    apiClient.setUserRole('ADMIN');
    await apiClient.deleteIamPolicy(denyPol.id);
    apiClient.setIamMode(prevMode);
  }
});

test('Predefined IAM permission catalog is unique, comprehensive, and strictly read-only (403 PERMISSION_CATALOG_READ_ONLY)', async () => {
  apiClient.setNetworkMode('LAN');
  apiClient.setUserRole('ADMIN');
  apiClient.setSessionActive(true);

  const perms = await apiClient.getIamPermissions();
  assert.ok(perms.length >= 22, 'Expected 22 predefined system permissions');

  const keys = perms.map((p) => `${p.action}:${p.resource_type}`);
  assert.equal(new Set(keys).size, keys.length, 'Predefined permissions must have no duplicate action:resource_type');

  // Kunci katalog memakai bentuk singular sesuai API Documentation
  // (policy `ack:operational_event`, `create:operator`, `update:operator`).
  for (const required of [
    'read:access_control',
    'ack:operational_event',
    'manage:product',
    'read:operator',
    'create:operator',
    'update_status:operator',
    'update:operator',
    'rotate_password:operator',
    'delete:operator',
    'read:mqtt_admin',
    'read:mqtt_configuration',
    'read:telemetry',
  ]) {
    assert.ok(keys.includes(required), `Missing predefined permission: ${required}`);
  }

  await assert.rejects(
    () =>
      apiClient.createIamPermission({
        action: 'read',
        resource_type: 'telemetry',
        description: 'Fixed catalog read-only check',
      }),
    (err: any) => err.httpStatus === 403 && err.code === 'PERMISSION_CATALOG_READ_ONLY'
  );
});

test('addIamRolePermission supports resourcePattern, effect, abacCondition, reason and blocks DENY on ADMIN', async () => {
  apiClient.setNetworkMode('LAN');
  apiClient.setUserRole('ADMIN');
  apiClient.setSessionActive(true);

  await assert.rejects(
    () =>
      apiClient.addIamRolePermission('role-admin', 'perm-22', {
        resourcePattern: 'telemetry:*',
        effect: 'DENY',
      }),
    (err: any) => err.httpStatus === 403 && err.code === 'FORBIDDEN'
  );

  await apiClient.addIamRolePermission('role-quality-auditor', 'perm-12', {
    resourcePattern: 'operational_events:LINE-01',
    effect: 'ALLOW',
    abacCondition: { line_id: 'LINE-01' },
    reason: 'QA audit ack scoped to Line 01',
  });

  const updatedPolicies = await apiClient.getIamPolicies();
  const createdRule = updatedPolicies.find(
    (p) =>
      p.role_id === 'role-quality-auditor' &&
      p.permission_id === 'perm-12' &&
      p.resource_pattern === 'operational_events:LINE-01'
  );
  assert.ok(createdRule, 'Expected role-permission policy binding with custom resource_pattern');
  assert.equal(createdRule.eft, 'ALLOW');
  assert.deepEqual(createdRule.abac_condition, { line_id: 'LINE-01' });

  await apiClient.removeIamRolePermission('role-quality-auditor', 'perm-12');
});
