/**
 * Method demo — domain mqttDynsec.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { store } from './store';
import { checkAbort, assertCapability, throwValidationIssues } from './helpers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { MqttClient, MqttRole, MqttAcl, MqttGroup, BrokerOverviewInfo } from '../../../types/mqtt';
import { ApiError } from '../../../types/auth';

export const demoMqttDynsec = {
  // =========================================================================
  // MQTT OVERVIEW + DYNAMIC SECURITY (1 + 23 = 24 ops)
  // =========================================================================
  async getBrokerOverview(signal?: AbortSignal): Promise<BrokerOverviewInfo> {
    checkAbort(signal);
    assertCapability('mqtt.overview.read', ['ADMIN'], { requireLan: false });
    store.recordEndpoint('MQTT_OVERVIEW', ADMIN_ENDPOINTS.MQTT_OVERVIEW.buildPath());
    const activeVer = store.configVersions.find((v) => v.status === 'ACTIVE');
    // E20 P20.5 (FAT-157): bentuk §3.3a — status dynsec `"READY"`;
    // count = jumlah seed demo (bukan null — demo punya datanya);
    // petakan `available`/`lastError`/`measuredAt`/`lastOperation`.
    return {
      dynamicSecurity: {
        available: true,
        enabled: true,
        status: 'READY',
        clientsCount: store.mqttClients.length,
        rolesCount: store.mqttRoles.length,
        groupsCount: store.mqttGroups.length,
        lastError: null,
        measuredAt: new Date().toISOString(),
      },
      configuration: {
        status: 'IN_SYNC',
        activeVersionId: activeVer?.version_id ?? null,
        lastAppliedAt: activeVer?.applied_at ?? null,
        mutationLocked: false,
        lastOperation: null,
        measuredAt: new Date().toISOString(),
      },
    };
  },

  async getMqttDynamicSecurityStatus(signal?: AbortSignal) {
    checkAbort(signal);
    assertCapability('mqtt.dynsec.read', ['ADMIN'], { requireLan: false });
    store.recordEndpoint('MQTT_DYNSEC_STATUS', ADMIN_ENDPOINTS.MQTT_DYNSEC_STATUS.buildPath());
    // E23 Batch 4 (FAT-203, N-33): demo meniru bentuk spec live —
    // {connected, subscribed, connecting, pluginReady, brokerUrl,
    // adminUsername, lastError, lastConnectedAt}; bentuk lama
    // (enabled/status/clients_count/…) sudah tidak dipakai.
    return {
      connected: true,
      subscribed: true,
      connecting: false,
      pluginReady: true,
      brokerUrl: 'mqtt://localhost:1883',
      adminUsername: 'admin',
      lastError: null,
      lastConnectedAt: new Date().toISOString(),
    };
  },

  async getMqttClients(signal?: AbortSignal): Promise<MqttClient[]> {
    checkAbort(signal);
    assertCapability('mqtt.dynsec.read', ['ADMIN'], { requireLan: false });
    store.recordEndpoint('MQTT_DYNSEC_CLIENTS_LIST', ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_LIST.buildPath());
    return store.mqttClients.map((c) => ({ ...c, roles: [...c.roles], groups: [...c.groups] }));
  },

  async getMqttClient(username: string, signal?: AbortSignal): Promise<MqttClient> {
    checkAbort(signal);
    assertCapability('mqtt.dynsec.read', ['ADMIN'], { requireLan: false, resourceId: username });
    store.recordEndpoint('MQTT_DYNSEC_CLIENTS_GET', ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_GET.buildPath(username));
    const client = store.mqttClients.find((c) => c.username === username);
    if (!client) {
      throw new ApiError({ code: 'NOT_FOUND', message: `MQTT Client "${username}" tidak ditemukan.`, httpStatus: 404 });
    }
    return { ...client, roles: [...client.roles], groups: [...client.groups] };
  },

  async createMqttClient(payload: {
    username: string;
    password?: string;
    clientid?: string;
    textname?: string;
    textdescription?: string;
    roles?: string[];
    groups?: string[];
  }): Promise<{ client: MqttClient; generatedPassword?: string }> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: payload.username });
    // E20 P20.2 (X1/X2, D-11): cabang deviceId+access (isProvision) DIHAPUS.
    // Provisioning perangkat HANYA lewat POST /api/v1/devices/provision
    // (demoDevices.provisionDevice); endpoint ini hanya mode roles.
    store.recordEndpoint('MQTT_DYNSEC_CLIENTS_CREATE', ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_CREATE.buildPath());

    if (store.mqttClients.some((c) => c.username === payload.username.trim())) {
      throw new ApiError({
        code: 'CONFLICT',
        message: `MQTT Client "${payload.username}" sudah ada.`,
        httpStatus: 409,
      });
    }

    const derivedRoles = payload.roles && payload.roles.length > 0 ? payload.roles : [];

    if (derivedRoles.length === 0) {
      throwValidationIssues('Minimal satu role MQTT wajib dipilih (default-deny).', {
        roles: 'Minimal 1 role wajib dipilih.',
      });
    }

    const generatedPassword =
      payload.password && payload.password.trim().length > 0
        ? undefined
        : `dynsec_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;

    const newClient: MqttClient = {
      username: payload.username.trim(),
      clientid: payload.clientid?.trim() || undefined,
      textname: payload.textname?.trim() || undefined,
      textdescription: payload.textdescription?.trim() || undefined,
      enabled: true,
      roles: derivedRoles,
      groups: payload.groups ?? [],
      created_at: new Date().toISOString(),
    };
    store.mqttClients.push(newClient);
    store.addAudit('MQTT_CLIENT_CREATED', 'MQTT_SECURITY', newClient.username, `Created dynsec client ${newClient.username}`);
    return { client: { ...newClient }, generatedPassword };
  },

  async deleteMqttClient(username: string): Promise<{ success: boolean }> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: username });
    store.recordEndpoint('MQTT_DYNSEC_CLIENTS_DELETE', ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_DELETE.buildPath(username));
    store.mqttClients = store.mqttClients.filter((c) => c.username !== username);
    store.mqttGroups.forEach((g) => {
      g.clients = g.clients.filter((cl) => cl !== username);
    });
    store.addAudit('MQTT_CLIENT_DELETED', 'MQTT_SECURITY', username, `Deleted MQTT client ${username}`);
    return { success: true };
  },

  async toggleMqttClient(username: string, enabled: boolean): Promise<MqttClient> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: username });
    store.recordEndpoint('MQTT_DYNSEC_CLIENTS_ENABLE', ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_ENABLE.buildPath(username));
    const c = store.mqttClients.find((cl) => cl.username === username);
    if (!c) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'MQTT Client tidak ditemukan.', httpStatus: 404 });
    }
    c.enabled = enabled;
    store.addAudit('MQTT_CLIENT_TOGGLED', 'MQTT_SECURITY', username, `Set enabled status to ${enabled}`);
    return { ...c };
  },

  async rotateMqttClientPassword(username: string, password: string): Promise<{ success: boolean }> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: username });
    store.recordEndpoint('MQTT_DYNSEC_CLIENTS_PASSWORD', ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_PASSWORD.buildPath(username));
    const c = store.mqttClients.find((cl) => cl.username === username);
    if (!c) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'MQTT Client tidak ditemukan.', httpStatus: 404 });
    }
    if (!password || password.length < 8) {
      throwValidationIssues('Password MQTT baru minimal 8 karakter.', { password: 'Minimal 8 karakter.' });
    }
    store.addAudit('MQTT_CLIENT_PASSWORD', 'MQTT_SECURITY', username, `Rotated MQTT password for ${username}`);
    return { success: true };
  },

  async addMqttClientRole(username: string, rolename: string, priority = 1): Promise<MqttClient> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: username });
    store.recordEndpoint('MQTT_DYNSEC_CLIENT_ROLES_ADD', ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENT_ROLES_ADD.buildPath(username));
    const c = store.mqttClients.find((cl) => cl.username === username);
    if (!c) throw new ApiError({ code: 'NOT_FOUND', message: 'MQTT Client tidak ditemukan.', httpStatus: 404 });
    if (!c.roles.includes(rolename)) c.roles.push(rolename);
    store.addAudit('MQTT_CLIENT_ROLE_ADDED', 'MQTT_SECURITY', username, `Added role ${rolename} (priority ${priority})`);
    return { ...c };
  },

  async removeMqttClientRole(username: string, rolename: string): Promise<void> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: username });
    store.recordEndpoint(
      'MQTT_DYNSEC_CLIENT_ROLES_DELETE',
      ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENT_ROLES_DELETE.buildPath(username, rolename)
    );
    const c = store.mqttClients.find((cl) => cl.username === username);
    if (c) c.roles = c.roles.filter((r) => r !== rolename);
    store.addAudit('MQTT_CLIENT_ROLE_REMOVED', 'MQTT_SECURITY', username, `Removed role ${rolename}`);
  },

  async getMqttRoles(signal?: AbortSignal): Promise<MqttRole[]> {
    checkAbort(signal);
    assertCapability('mqtt.dynsec.read', ['ADMIN'], { requireLan: false });
    store.recordEndpoint('MQTT_DYNSEC_ROLES_LIST', ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLES_LIST.buildPath());
    return store.mqttRoles.map((r) => ({ ...r, acls: r.acls.map((a) => ({ ...a })) }));
  },

  async getMqttRole(rolename: string, signal?: AbortSignal): Promise<MqttRole> {
    checkAbort(signal);
    assertCapability('mqtt.dynsec.read', ['ADMIN'], { requireLan: false, resourceId: rolename });
    store.recordEndpoint('MQTT_DYNSEC_ROLES_GET', ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLES_GET.buildPath(rolename));
    const role = store.mqttRoles.find((r) => r.rolename === rolename);
    if (!role) throw new ApiError({ code: 'NOT_FOUND', message: 'MQTT Role tidak ditemukan.', httpStatus: 404 });
    return { ...role, acls: role.acls.map((a) => ({ ...a })) };
  },

  async createMqttRole(role: MqttRole): Promise<MqttRole> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: role.rolename });
    store.recordEndpoint('MQTT_DYNSEC_ROLES_CREATE', ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLES_CREATE.buildPath());
    if (store.mqttRoles.some((r) => r.rolename === role.rolename.trim())) {
      throw new ApiError({ code: 'CONFLICT', message: `MQTT role "${role.rolename}" sudah ada.`, httpStatus: 409 });
    }
    const created: MqttRole = {
      rolename: role.rolename.trim(),
      textname: role.textname?.trim(),
      textdescription: role.textdescription?.trim(),
      acls: role.acls ?? [],
    };
    store.mqttRoles.push(created);
    store.addAudit('MQTT_ROLE_CREATED', 'MQTT_SECURITY', created.rolename, `Created MQTT role ${created.rolename}`);
    return { ...created };
  },

  async deleteMqttRole(rolename: string): Promise<{ success: boolean }> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: rolename });
    store.recordEndpoint('MQTT_DYNSEC_ROLES_DELETE', ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLES_DELETE.buildPath(rolename));
    store.mqttRoles = store.mqttRoles.filter((r) => r.rolename !== rolename);
    store.mqttClients.forEach((c) => {
      c.roles = c.roles.filter((r) => r !== rolename);
    });
    store.mqttGroups.forEach((g) => {
      g.roles = g.roles.filter((r) => r !== rolename);
    });
    store.addAudit('MQTT_ROLE_DELETED', 'MQTT_SECURITY', rolename, `Deleted MQTT role ${rolename}`);
    return { success: true };
  },

  async addMqttRoleAcl(rolename: string, acl: MqttAcl): Promise<MqttRole> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: rolename });
    store.recordEndpoint('MQTT_DYNSEC_ROLE_ACLS_ADD', ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLE_ACLS_ADD.buildPath(rolename));
    const role = store.mqttRoles.find((r) => r.rolename === rolename);
    if (!role) throw new ApiError({ code: 'NOT_FOUND', message: 'MQTT Role tidak ditemukan.', httpStatus: 404 });
    role.acls.push({ ...acl });
    store.addAudit('MQTT_ROLE_ACL_ADDED', 'MQTT_SECURITY', rolename, `Added ACL ${acl.acltype} ${acl.topic}`);
    return { ...role, acls: [...role.acls] };
  },

  async removeMqttRoleAcl(rolename: string, acltype: MqttAcl['acltype'], topic: string): Promise<void> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: rolename });
    store.recordEndpoint('MQTT_DYNSEC_ROLE_ACLS_DELETE', ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLE_ACLS_DELETE.buildPath(rolename));
    const role = store.mqttRoles.find((r) => r.rolename === rolename);
    if (role) {
      role.acls = role.acls.filter((a) => !(a.acltype === acltype && a.topic === topic));
    }
    store.addAudit('MQTT_ROLE_ACL_REMOVED', 'MQTT_SECURITY', rolename, `Removed ACL ${acltype} ${topic}`);
  },

  async getMqttGroups(signal?: AbortSignal): Promise<MqttGroup[]> {
    checkAbort(signal);
    assertCapability('mqtt.dynsec.read', ['ADMIN'], { requireLan: false });
    store.recordEndpoint('MQTT_DYNSEC_GROUPS_LIST', ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUPS_LIST.buildPath());
    return store.mqttGroups.map((g) => ({ ...g, clients: [...g.clients], roles: [...g.roles] }));
  },

  async getMqttGroup(groupname: string, signal?: AbortSignal): Promise<MqttGroup> {
    checkAbort(signal);
    assertCapability('mqtt.dynsec.read', ['ADMIN'], { requireLan: false, resourceId: groupname });
    store.recordEndpoint('MQTT_DYNSEC_GROUPS_GET', ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUPS_GET.buildPath(groupname));
    const grp = store.mqttGroups.find((g) => g.groupname === groupname);
    if (!grp) throw new ApiError({ code: 'NOT_FOUND', message: 'MQTT Group tidak ditemukan.', httpStatus: 404 });
    return { ...grp, clients: [...grp.clients], roles: [...grp.roles] };
  },

  async createMqttGroup(group: MqttGroup): Promise<MqttGroup> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: group.groupname });
    store.recordEndpoint('MQTT_DYNSEC_GROUPS_CREATE', ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUPS_CREATE.buildPath());
    if (store.mqttGroups.some((g) => g.groupname === group.groupname.trim())) {
      throw new ApiError({ code: 'CONFLICT', message: `MQTT group "${group.groupname}" sudah ada.`, httpStatus: 409 });
    }
    const created: MqttGroup = {
      groupname: group.groupname.trim(),
      textname: group.textname?.trim(),
      textdescription: group.textdescription?.trim(),
      clients: group.clients ?? [],
      roles: group.roles ?? [],
    };
    store.mqttGroups.push(created);
    store.addAudit('MQTT_GROUP_CREATED', 'MQTT_SECURITY', created.groupname, `Created MQTT group ${created.groupname}`);
    return { ...created };
  },

  async deleteMqttGroup(groupname: string): Promise<{ success: boolean }> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: groupname });
    store.recordEndpoint('MQTT_DYNSEC_GROUPS_DELETE', ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUPS_DELETE.buildPath(groupname));
    store.mqttGroups = store.mqttGroups.filter((g) => g.groupname !== groupname);
    store.mqttClients.forEach((c) => {
      c.groups = c.groups.filter((gr) => gr !== groupname);
    });
    store.addAudit('MQTT_GROUP_DELETED', 'MQTT_SECURITY', groupname, `Deleted MQTT group ${groupname}`);
    return { success: true };
  },

  async addMqttGroupClient(groupname: string, username: string): Promise<MqttGroup> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: groupname });
    store.recordEndpoint('MQTT_DYNSEC_GROUP_CLIENTS_ADD', ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUP_CLIENTS_ADD.buildPath(groupname));
    const grp = store.mqttGroups.find((g) => g.groupname === groupname);
    if (!grp) throw new ApiError({ code: 'NOT_FOUND', message: 'MQTT Group tidak ditemukan.', httpStatus: 404 });
    if (!grp.clients.includes(username)) grp.clients.push(username);
    const cl = store.mqttClients.find((c) => c.username === username);
    if (cl && !cl.groups.includes(groupname)) cl.groups.push(groupname);
    store.addAudit('MQTT_GROUP_CLIENT_ADDED', 'MQTT_SECURITY', groupname, `Added ${username} to group ${groupname}`);
    return { ...grp };
  },

  async removeMqttGroupClient(groupname: string, username: string): Promise<void> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: groupname });
    store.recordEndpoint(
      'MQTT_DYNSEC_GROUP_CLIENTS_DELETE',
      ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUP_CLIENTS_DELETE.buildPath(groupname, username)
    );
    const grp = store.mqttGroups.find((g) => g.groupname === groupname);
    if (grp) grp.clients = grp.clients.filter((c) => c !== username);
    const cl = store.mqttClients.find((c) => c.username === username);
    if (cl) cl.groups = cl.groups.filter((g) => g !== groupname);
    store.addAudit('MQTT_GROUP_CLIENT_REMOVED', 'MQTT_SECURITY', groupname, `Removed ${username} from group ${groupname}`);
  },

  async addMqttGroupRole(groupname: string, rolename: string): Promise<MqttGroup> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: groupname });
    store.recordEndpoint('MQTT_DYNSEC_GROUP_ROLES_ADD', ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUP_ROLES_ADD.buildPath(groupname));
    const grp = store.mqttGroups.find((g) => g.groupname === groupname);
    if (!grp) throw new ApiError({ code: 'NOT_FOUND', message: 'MQTT Group tidak ditemukan.', httpStatus: 404 });
    if (!grp.roles.includes(rolename)) grp.roles.push(rolename);
    store.addAudit('MQTT_GROUP_ROLE_ADDED', 'MQTT_SECURITY', groupname, `Added role ${rolename} to group ${groupname}`);
    return { ...grp };
  },

  async removeMqttGroupRole(groupname: string, rolename: string): Promise<void> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: groupname });
    store.recordEndpoint(
      'MQTT_DYNSEC_GROUP_ROLES_DELETE',
      ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUP_ROLES_DELETE.buildPath(groupname, rolename)
    );
    const grp = store.mqttGroups.find((g) => g.groupname === groupname);
    if (grp) grp.roles = grp.roles.filter((r) => r !== rolename);
    store.addAudit('MQTT_GROUP_ROLE_REMOVED', 'MQTT_SECURITY', groupname, `Removed role ${rolename} from group ${groupname}`);
  }
};
