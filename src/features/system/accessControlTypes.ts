import type { IamRole } from '../../types/iam';

/** Satu-satunya tempat definisi tab AccessControl (dulu lokal di page, L44). */
export type IamTab = 'roles' | 'assignments' | 'policies' | 'permissions' | 'inspector';

export interface IamFeedback {
  type: 'success' | 'error';
  msg: string;
}

/** Target dialog konfirmasi Cabut Permission (dibagi RolesTab, RoleDetailModal, ConfirmDialogs). */
export interface UnbindTarget {
  role: IamRole;
  permissionId: string;
  label: string;
}

/**
 * Dependensi bersama semua hook mutasi IAM: corong afterMutation (reload +
 * refreshCapabilities + advisory authz_version), pelaporan error, kunci
 * submit global, dan setter banner feedback — semuanya dimiliki useIamData.
 */
export interface IamMutationDeps {
  afterMutation: (msg: string, bumpsAuthz?: boolean) => Promise<void>;
  reportError: (err: unknown, fallbackMsg: string, resourceId?: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  setFeedback: (feedback: IamFeedback | null) => void;
}
