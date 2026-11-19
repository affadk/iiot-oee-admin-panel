import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CapabilityDenialStore,
  VALIDATION_PATTERNS,
  buildAuthMeCapabilities,
  evaluateCapability,
  evaluateCasbinAbacDecision,
  isAdminRoleName,
  isReservedPermission,
  policyMatchesSubject,
  validateDeviceInput,
  validateMachineInput,
  validateOperatorInput,
  validateProductInput,
} from './capabilities';
import type { IamPolicyRule } from '../types/iam';

/** Factory policy kanonis (§3.4) untuk tes evaluator. */
function makePolicy(over: Partial<IamPolicyRule> & { id: string }): IamPolicyRule {
  return {
    roleId: 'role-x',
    roleName: 'X',
    subjectMatch: 'role:X',
    permissionId: 'perm-00',
    action: 'read:oee',
    resourceType: 'oee',
    resourcePattern: '*',
    effect: 'ALLOW',
    abacCondition: null,
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

test('Build Guide §4.5: unknown capabilities remain interactive (canInteract = true) and never proactively disable', () => {
  const res = evaluateCapability('downtime_event.label', {
    role: 'OPERATOR',
    networkMode: 'LAN',
    isAuthenticated: true,
    resourceId: 'dt-ev-05',
  });
  assert.equal(res.state, 'unknown');
  assert.equal(res.canInteract, true);

  const woCancel = evaluateCapability('work_order.cancel', {
    role: 'ADMIN',
    networkMode: 'LAN',
    isAuthenticated: true,
    resourceId: 'WO-2026-103',
  });
  assert.equal(woCancel.state, 'unknown');
  assert.equal(woCancel.canInteract, true);
});

test('GET /api/v1/auth/me capability projection overrides baseline role specs when present', () => {
  const customProjection = buildAuthMeCapabilities('SUPERVISOR', true, 'enforce');
  assert.equal(customProjection['operator.read'], 'allow');
  assert.equal(customProjection['access_control.manage'], 'deny');
  assert.equal(customProjection['operational_event.ack'], 'unknown');
  assert.equal(customProjection['telemetry.reconciliation.refresh'], 'unknown');

  // Shadow mode turns attribute-dependent capabilities into 'unknown' instead of 'deny'
  const shadowProjection = buildAuthMeCapabilities('OPERATOR', true, 'shadow');
  assert.equal(shadowProjection['work_order.cancel'], 'unknown');
  assert.equal(shadowProjection['access_control.manage'], 'deny'); // roleOnly stays 'deny'

  // Server allow overrides baseline role restriction cleanly when not forceUnknownScope
  const serverAllowed = evaluateCapability('work_order.cancel', {
    role: 'SUPERVISOR',
    networkMode: 'LAN',
    isAuthenticated: true,
    serverCapabilities: { 'work_order.cancel': 'allow' },
  });
  assert.equal(serverAllowed.state, 'allowed');
  assert.equal(serverAllowed.canInteract, true);

  // Server deny overrides even if static role allows
  const serverDenied = evaluateCapability('telemetry.refresh', {
    role: 'SUPERVISOR',
    networkMode: 'REMOTE_TUNNEL',
    isAuthenticated: true,
    serverCapabilities: { 'telemetry.refresh': 'deny' },
  });
  assert.equal(serverDenied.state, 'denied');
  assert.equal(serverDenied.canInteract, false);
  assert.match(serverDenied.reason ?? '', /tidak memiliki izin/);

  // Server unknown stays interactive
  const serverUnknown = evaluateCapability('work_order.cancel', {
    role: 'OPERATOR',
    networkMode: 'LAN',
    isAuthenticated: true,
    serverCapabilities: { 'work_order.cancel': 'unknown' },
  });
  assert.equal(serverUnknown.state, 'unknown');
  assert.equal(serverUnknown.canInteract, true);
});

test('CapabilityDenialStore: role-only 403 downgrades globally while scoped 403 downgrades per (capability, resourceId)', () => {
  const store = new CapabilityDenialStore();

  // Scoped capability: only target resourceId becomes denied
  store.recordDenial('work_order.cancel', 'WO-2026-101', 'ABAC scope mismatch on line');
  const deniedTarget = evaluateCapability('work_order.cancel', {
    role: 'ADMIN',
    networkMode: 'LAN',
    isAuthenticated: true,
    resourceId: 'WO-2026-101',
    denialStore: store,
  });
  assert.equal(deniedTarget.state, 'denied');
  assert.equal(deniedTarget.canInteract, false);
  assert.match(deniedTarget.reason ?? '', /ABAC scope mismatch/);

  const otherTarget = evaluateCapability('work_order.cancel', {
    role: 'ADMIN',
    networkMode: 'LAN',
    isAuthenticated: true,
    resourceId: 'WO-2026-103',
    denialStore: store,
  });
  assert.equal(otherTarget.canInteract, true);

  // Role-only capability: downgrades globally across session
  store.recordDenial('telemetry.refresh', 'STM32-OEE-01', 'Missing refresh:telemetry');
  const exportDeniedGlobal = evaluateCapability('telemetry.refresh', {
    role: 'SUPERVISOR',
    networkMode: 'LAN',
    isAuthenticated: true,
    resourceId: 'STM32-OEE-02',
    denialStore: store,
  });
  assert.equal(exportDeniedGlobal.state, 'denied');
  assert.equal(exportDeniedGlobal.canInteract, false);

  store.clearAll();
  const afterClear = evaluateCapability('telemetry.refresh', {
    role: 'SUPERVISOR',
    networkMode: 'LAN',
    isAuthenticated: true,
    denialStore: store,
  });
  assert.equal(afterClear.state, 'allowed');
  assert.equal(afterClear.canInteract, true);
});

test('REMOTE_TUNNEL and unauthenticated states block LAN-only / auth-required capabilities while allowing dynsec.read & export.telemetry', () => {
  const tunnelMut = evaluateCapability('machine.manage', {
    role: 'ADMIN',
    networkMode: 'REMOTE_TUNNEL',
    isAuthenticated: true,
  });
  assert.equal(tunnelMut.state, 'denied');
  assert.equal(tunnelMut.canInteract, false);
  assert.match(tunnelMut.reason ?? '', /Mode observasi/);

  const tunnelDynsecRead = evaluateCapability('mqtt.dynsec.read', {
    role: 'ADMIN',
    networkMode: 'REMOTE_TUNNEL',
    isAuthenticated: true,
  });
  assert.equal(tunnelDynsecRead.state, 'allowed');
  assert.equal(tunnelDynsecRead.canInteract, true);

  const tunnelDynsecManage = evaluateCapability('mqtt.dynsec.manage', {
    role: 'ADMIN',
    networkMode: 'REMOTE_TUNNEL',
    isAuthenticated: true,
  });
  assert.equal(tunnelDynsecManage.state, 'denied');
  assert.equal(tunnelDynsecManage.canInteract, false);

  // telemetry.refresh works on REMOTE_TUNNEL for authenticated ADMIN/SUPERVISOR
  const tunnelExport = evaluateCapability('telemetry.refresh', {
    role: 'SUPERVISOR',
    networkMode: 'REMOTE_TUNNEL',
    isAuthenticated: true,
  });
  assert.equal(tunnelExport.state, 'allowed');
  assert.equal(tunnelExport.canInteract, true);

  const unauthExport = evaluateCapability('telemetry.refresh', {
    role: 'ADMIN',
    networkMode: 'LAN',
    isAuthenticated: false,
  });
  assert.equal(unauthExport.state, 'denied');
  assert.equal(unauthExport.canInteract, false);
});

test('Casbin 4-Dim ABAC Evaluator: ORGANIZATION-only effective roles, DENY wins, malformed JSON fail-closed, and shadow mismatch', () => {
  // 1. Only ORGANIZATION assignments grant admin-panel effective roles
  const scopedResult = evaluateCasbinAbacDecision({
    primaryRole: 'OPERATOR',
    assignments: [
      { role_name: 'SUPERVISOR', scope_type: 'LINE' },
      { role_name: 'QUALITY_AUDITOR', scope_type: 'ORGANIZATION' },
    ],
    policies: [
      makePolicy({
        id: 'pol-qa',
        roleId: 'role-quality-auditor',
        roleName: 'QUALITY_AUDITOR',
        subjectMatch: 'role:QUALITY_AUDITOR',
        permissionId: 'perm-22',
        action: 'read:oee',
        resourceType: 'oee',
        resourcePattern: 'oee:*',
      }),
      makePolicy({
        id: 'pol-sup',
        roleId: 'role-supervisor',
        roleName: 'SUPERVISOR',
        subjectMatch: 'role:SUPERVISOR',
        permissionId: 'perm-06',
        action: 'refresh:telemetry',
        resourceType: 'telemetry',
        resourcePattern: 'telemetry:*',
      }),
    ],
    mode: 'enforce',
    action: 'read:oee',
    resourceKey: 'oee:CNC-01',
    baselineAllowed: false,
  });
  assert.deepEqual(scopedResult.effectiveRoles, ['OPERATOR', 'QUALITY_AUDITOR']);
  assert.equal(scopedResult.finalDecision, 'ALLOW');

  const blockedLineRole = evaluateCasbinAbacDecision({
    primaryRole: 'OPERATOR',
    assignments: [{ role_name: 'SUPERVISOR', scope_type: 'LINE' }],
    policies: [
      makePolicy({
        id: 'pol-sup',
        roleId: 'role-supervisor',
        roleName: 'SUPERVISOR',
        subjectMatch: 'role:SUPERVISOR',
        permissionId: 'perm-06',
        action: 'refresh:telemetry',
        resourceType: 'telemetry',
        resourcePattern: 'telemetry:*',
      }),
    ],
    mode: 'enforce',
    action: 'refresh:telemetry',
    resourceKey: 'telemetry:STM32-01',
    baselineAllowed: false,
  });
  assert.equal(blockedLineRole.finalDecision, 'DENY');

  // 2. DENY wins over ALLOW
  const denyWins = evaluateCasbinAbacDecision({
    primaryRole: 'SUPERVISOR',
    assignments: [],
    policies: [
      makePolicy({
        id: 'p1',
        roleId: 'role-supervisor',
        roleName: 'SUPERVISOR',
        subjectMatch: 'role:SUPERVISOR',
        permissionId: 'perm-06',
        action: 'refresh:telemetry',
        resourceType: 'telemetry',
        resourcePattern: 'telemetry:*',
      }),
      makePolicy({
        id: 'p2',
        roleId: 'role-supervisor',
        roleName: 'SUPERVISOR',
        subjectMatch: 'role:SUPERVISOR',
        permissionId: 'perm-06',
        action: 'refresh:telemetry',
        resourceType: 'telemetry',
        resourcePattern: 'telemetry:STM32-01',
        effect: 'DENY',
      }),
    ],
    mode: 'enforce',
    action: 'refresh:telemetry',
    resourceKey: 'telemetry:STM32-01',
    baselineAllowed: true,
  });
  assert.equal(denyWins.finalDecision, 'DENY');
  assert.match(denyWins.reason, /eksplisit DENY/);

  // 3. Malformed abac_condition fails closed (operator `all` bukan array)
  const malformedAbac = evaluateCasbinAbacDecision({
    primaryRole: 'SUPERVISOR',
    assignments: [],
    policies: [
      makePolicy({
        id: 'p-bad-abac',
        roleId: 'role-supervisor',
        roleName: 'SUPERVISOR',
        subjectMatch: 'role:SUPERVISOR',
        permissionId: 'perm-06',
        action: 'refresh:telemetry',
        resourceType: 'telemetry',
        resourcePattern: 'telemetry:*',
        abacCondition: { all: 'not-an-array' },
      }),
    ],
    mode: 'enforce',
    action: 'refresh:telemetry',
    resourceKey: 'telemetry:STM32-01',
    baselineAllowed: true,
  });
  assert.equal(malformedAbac.finalDecision, 'DENY');
  assert.match(malformedAbac.reason, /fail-closed DENY/);

  // 4. Shadow mode keeps baseline decision while flagging SHADOW_MISMATCH
  const shadowCheck = evaluateCasbinAbacDecision({
    primaryRole: 'SUPERVISOR',
    assignments: [],
    policies: [
      makePolicy({
        id: 'p-deny',
        roleId: 'role-supervisor',
        roleName: 'SUPERVISOR',
        subjectMatch: 'role:SUPERVISOR',
        permissionId: 'perm-06',
        action: 'refresh:telemetry',
        resourceType: 'telemetry',
        resourcePattern: 'telemetry:*',
        effect: 'DENY',
      }),
    ],
    mode: 'shadow',
    action: 'refresh:telemetry',
    resourceKey: 'telemetry:STM32-01',
    baselineAllowed: true,
  });
  assert.equal(shadowCheck.finalDecision, 'ALLOW');
  assert.equal(shadowCheck.policyDecision, 'DENY');
  assert.equal(shadowCheck.shadowMismatch, true);
  assert.match(shadowCheck.reason, /SHADOW_MISMATCH/);
});

test('IAM helpers: isAdminRoleName & policyMatchesSubject enforce §3.4 subject patterns (no hierarchy levels)', () => {
  assert.equal(isAdminRoleName('ADMIN'), true);
  assert.equal(isAdminRoleName('admin'), true);
  assert.equal(isAdminRoleName('SUPERVISOR'), false);
  assert.equal(isAdminRoleName('QUALITY_AUDITOR'), false);

  assert.equal(policyMatchesSubject('*', { role: 'OPERATOR' }), true);
  assert.equal(policyMatchesSubject('role:SUPERVISOR', { role: 'SUPERVISOR' }), true);
  assert.equal(policyMatchesSubject('role:SUPERVISOR', { role: 'OPERATOR' }), false);
  assert.equal(policyMatchesSubject('operator:OP-115', { role: 'OPERATOR', operatorId: 'OP-115' }), true);
  assert.equal(policyMatchesSubject('operator:OP-115', { role: 'OPERATOR', operatorId: 'OP-999' }), false);
  assert.equal(policyMatchesSubject('operator:OP-115', { role: 'OPERATOR' }), false);
  // Nama role polos diterima sebagai alias `role:<nama>` (bentuk lama).
  assert.equal(policyMatchesSubject('SUPERVISOR', { role: 'SUPERVISOR' }), true);

  assert.equal(isReservedPermission('manage', 'access_control'), true);
  assert.equal(isReservedPermission('manage', 'mqtt_admin'), true);
  assert.equal(isReservedPermission('manage', 'mqtt_configuration'), true);
  assert.equal(isReservedPermission('read_raw', 'mqtt_configuration'), true);
  assert.equal(isReservedPermission('read', 'work_orders'), false);
});

test('Build Guide §7.2: client-side regex and entity validators mirror backend Zod rules', () => {
  assert.match('STM32-OEE-01', VALIDATION_PATTERNS.DEVICE_ID);
  assert.doesNotMatch('ESP32-01', VALIDATION_PATTERNS.DEVICE_ID);
  assert.match('CNC-MILLING-01', VALIDATION_PATTERNS.MACHINE_ID);
  assert.doesNotMatch('MILL-01', VALIDATION_PATTERNS.MACHINE_ID);

  const badDev = validateDeviceInput({
    deviceId: 'BAD-01',
    macAddress: 'INVALID',
    ipAddress: '999.999.1.1',
    isCreate: true,
  });
  assert.ok(badDev.deviceId);
  assert.ok(badDev.macAddress);
  assert.ok(badDev.ipAddress);

  const okDev = validateDeviceInput({
    deviceId: 'STM32-OEE-09',
    macAddress: '00:08:DC:55:01:09',
    ipAddress: '192.168.10.109',
    firmwareVersion: 'v2.4.1',
    isCreate: true,
  });
  assert.deepEqual(okDev, {});

  const badMachine = validateMachineInput({
    machineId: 'bad-id',
    machineName: 'AB',
    modbusSlaveId: 250,
    isCreate: true,
  });
  assert.ok(badMachine.machineId);
  assert.ok(badMachine.machineName);
  assert.ok(badMachine.modbusSlaveId);

  const badProduct = validateProductInput({
    productId: 'p1',
    productName: 'X',
    stdCycleTimeSec: 0,
    isCreate: true,
  });
  assert.ok(badProduct.productId);
  assert.ok(badProduct.productName);
  assert.ok(badProduct.stdCycleTimeSec);

  const badOperator = validateOperatorInput({
    operatorId: 'a',
    operatorName: 'Bo',
    password: 'short',
    isCreate: true,
  });
  assert.ok(badOperator.operatorId);
  assert.ok(badOperator.operatorName);
  assert.ok(badOperator.password);
});
