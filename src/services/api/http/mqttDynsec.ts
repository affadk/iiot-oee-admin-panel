/**
 * Method HTTP — domain mqttDynsec.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { MUTATION_TIMEOUT_MS, assertLanForMutation, assertAuthenticatedHttp, reqJson, reqList, checkAbortHttp } from './transport';
import { mapMqttClient, mapMqttRole, mapMqttGroup, mapBrokerOverview, mapMqttDynsecStatus } from './mappers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { MqttClient, MqttRole, MqttAcl, MqttGroup, BrokerOverviewInfo } from '../../../types/mqtt';

export const httpMqttDynsec = {
  // -- MQTT (DynSec + broker config) ------------------------------------------
  async getBrokerOverview(signal?: AbortSignal): Promise<BrokerOverviewInfo> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.MQTT_OVERVIEW.buildPath(), signal, endpointKey: 'MQTT_OVERVIEW', capability: 'mqtt.overview.read' },
      mapBrokerOverview,
    );
  },

  async getMqttDynamicSecurityStatus(signal?: AbortSignal): Promise<{
    enabled: boolean;
    status: 'CONNECTED' | 'DISCONNECTED';
    clients_count: number;
    roles_count: number;
    groups_count: number;
  }> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.MQTT_DYNSEC_STATUS.buildPath(), signal, endpointKey: 'MQTT_DYNSEC_STATUS', capability: 'mqtt.dynsec.read' },
      mapMqttDynsecStatus,
    );
  },

  async getMqttClients(signal?: AbortSignal): Promise<MqttClient[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_LIST.buildPath(), signal, endpointKey: 'MQTT_DYNSEC_CLIENTS_LIST', capability: 'mqtt.dynsec.read' },
      mapMqttClient,
      100,
    ).then((p) => p.data);
  },

  async getMqttClient(username: string, signal?: AbortSignal): Promise<MqttClient> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_GET.buildPath(username), signal, endpointKey: 'MQTT_DYNSEC_CLIENTS_GET', capability: 'mqtt.dynsec.read', resourceId: username },
      mapMqttClient,
    );
  },

  async createMqttClient(data: {
    username: string;
    password?: string;
    clientid?: string;
    textname?: string;
    textdescription?: string;
    roles?: string[];
    groups?: string[];
  }): Promise<{ client: MqttClient; generatedPassword?: string }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    // E20 P20.2 (X1/X2, D-11): cabang deviceId+access + accessMap DIHAPUS.
    // Provisioning perangkat HANYA lewat POST /api/v1/devices/provision
    // (§E.3a); endpoint ini hanya membuat client dynsec mode roles.
    const body: Record<string, unknown> = {
      username: data.username.trim(),
      password: data.password ?? '',
      ...(data.clientid ? { clientid: data.clientid } : {}),
      roles: (data.roles ?? []).map((r) => ({ rolename: r, priority: 1 })),
    };
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_CREATE.buildPath(),
      body,
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_DYNSEC_CLIENTS_CREATE',
      capability: 'mqtt.dynsec.manage',
      resourceId: data.username,
    });
    const client = mapMqttClient(raw.client ?? raw);
    const generatedPassword = (raw.generatedPassword as string | undefined) ?? (raw.password as string | undefined);
    return { client, generatedPassword };
  },
  async deleteMqttClient(username: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_DELETE.buildPath(username),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_DYNSEC_CLIENTS_DELETE',
      capability: 'mqtt.dynsec.manage',
      resourceId: username,
    });
    return { success: raw?.success ?? true };
  },

  async rotateMqttClientPassword(username: string, password: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'PATCH',
      path: ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_PASSWORD.buildPath(username),
      body: { password },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_DYNSEC_CLIENTS_PASSWORD',
      capability: 'mqtt.dynsec.manage',
      resourceId: username,
    });
    return { success: raw?.success ?? true };
  },

  async toggleMqttClient(username: string, enabled: boolean): Promise<MqttClient> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PATCH',
        path: ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_ENABLE.buildPath(username),
        body: { enabled },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MQTT_DYNSEC_CLIENTS_ENABLE',
        capability: 'mqtt.dynsec.manage',
        resourceId: username,
      },
      mapMqttClient,
    );
  },

  async addMqttClientRole(username: string, rolename: string, priority = 1): Promise<MqttClient> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENT_ROLES_ADD.buildPath(username),
        body: { rolename, priority },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MQTT_DYNSEC_CLIENT_ROLES_ADD',
        capability: 'mqtt.dynsec.manage',
        resourceId: username,
      },
      mapMqttClient,
    );
  },

  async removeMqttClientRole(username: string, rolename: string): Promise<void> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    await reqJson<unknown>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENT_ROLES_DELETE.buildPath(username, rolename),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_DYNSEC_CLIENT_ROLES_DELETE',
      capability: 'mqtt.dynsec.manage',
      resourceId: username,
    });
  },

  async getMqttRoles(signal?: AbortSignal): Promise<MqttRole[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLES_LIST.buildPath(), signal, endpointKey: 'MQTT_DYNSEC_ROLES_LIST', capability: 'mqtt.dynsec.read' },
      mapMqttRole,
      100,
    ).then((p) => p.data);
  },

  async getMqttRole(rolename: string, signal?: AbortSignal): Promise<MqttRole> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLES_GET.buildPath(rolename), signal, endpointKey: 'MQTT_DYNSEC_ROLES_GET', capability: 'mqtt.dynsec.read', resourceId: rolename },
      mapMqttRole,
    );
  },

  async createMqttRole(role: MqttRole): Promise<MqttRole> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLES_CREATE.buildPath(),
        body: {
          rolename: role.rolename.trim(),
          acls: role.acls,
          ...(role.textname ? { textname: role.textname } : {}),
          ...(role.textdescription ? { textdescription: role.textdescription } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MQTT_DYNSEC_ROLES_CREATE',
        capability: 'mqtt.dynsec.manage',
        resourceId: role.rolename,
      },
      mapMqttRole,
    );
  },

  async deleteMqttRole(rolename: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLES_DELETE.buildPath(rolename),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_DYNSEC_ROLES_DELETE',
      capability: 'mqtt.dynsec.manage',
      resourceId: rolename,
    });
    return { success: raw?.success ?? true };
  },

  async addMqttRoleAcl(rolename: string, acl: MqttAcl): Promise<MqttRole> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLE_ACLS_ADD.buildPath(rolename),
        body: acl,
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MQTT_DYNSEC_ROLE_ACLS_ADD',
        capability: 'mqtt.dynsec.manage',
        resourceId: rolename,
      },
      mapMqttRole,
    );
  },

  async removeMqttRoleAcl(rolename: string, acltype: MqttAcl['acltype'], topic: string): Promise<void> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    await reqJson<unknown>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLE_ACLS_DELETE.buildPath(rolename),
      body: { acltype, topic },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_DYNSEC_ROLE_ACLS_DELETE',
      capability: 'mqtt.dynsec.manage',
      resourceId: rolename,
    });
  },

  async getMqttGroups(signal?: AbortSignal): Promise<MqttGroup[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUPS_LIST.buildPath(), signal, endpointKey: 'MQTT_DYNSEC_GROUPS_LIST', capability: 'mqtt.dynsec.read' },
      mapMqttGroup,
      100,
    ).then((p) => p.data);
  },

  async getMqttGroup(groupname: string, signal?: AbortSignal): Promise<MqttGroup> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUPS_GET.buildPath(groupname), signal, endpointKey: 'MQTT_DYNSEC_GROUPS_GET', capability: 'mqtt.dynsec.read', resourceId: groupname },
      mapMqttGroup,
    );
  },

  async createMqttGroup(group: MqttGroup): Promise<MqttGroup> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUPS_CREATE.buildPath(),
        body: {
          groupname: group.groupname.trim(),
          ...(group.textname ? { textname: group.textname } : {}),
          ...(group.textdescription ? { textdescription: group.textdescription } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MQTT_DYNSEC_GROUPS_CREATE',
        capability: 'mqtt.dynsec.manage',
        resourceId: group.groupname,
      },
      mapMqttGroup,
    );
  },

  async deleteMqttGroup(groupname: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUPS_DELETE.buildPath(groupname),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_DYNSEC_GROUPS_DELETE',
      capability: 'mqtt.dynsec.manage',
      resourceId: groupname,
    });
    return { success: raw?.success ?? true };
  },

  async addMqttGroupClient(groupname: string, username: string): Promise<MqttGroup> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUP_CLIENTS_ADD.buildPath(groupname),
        body: { username },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MQTT_DYNSEC_GROUP_CLIENTS_ADD',
        capability: 'mqtt.dynsec.manage',
        resourceId: groupname,
      },
      mapMqttGroup,
    );
  },

  async removeMqttGroupClient(groupname: string, username: string): Promise<void> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    await reqJson<unknown>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUP_CLIENTS_DELETE.buildPath(groupname, username),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_DYNSEC_GROUP_CLIENTS_DELETE',
      capability: 'mqtt.dynsec.manage',
      resourceId: groupname,
    });
  },

  async addMqttGroupRole(groupname: string, rolename: string): Promise<MqttGroup> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUP_ROLES_ADD.buildPath(groupname),
        body: { rolename },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MQTT_DYNSEC_GROUP_ROLES_ADD',
        capability: 'mqtt.dynsec.manage',
        resourceId: groupname,
      },
      mapMqttGroup,
    );
  },

  async removeMqttGroupRole(groupname: string, rolename: string): Promise<void> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    await reqJson<unknown>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUP_ROLES_DELETE.buildPath(groupname, rolename),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_DYNSEC_GROUP_ROLES_DELETE',
      capability: 'mqtt.dynsec.manage',
      resourceId: groupname,
    });
  }
};
