import type { IamAssignment, IamPolicyRule, IamRole } from '../../../types/iam';
import type { UnbindTarget } from '../accessControlTypes';
import { ConfirmationDialog } from '../../../components/ui/ConfirmationDialog';

interface AccessControlConfirmDialogsProps {
  deleteRoleTarget: IamRole | null;
  unbindTarget: UnbindTarget | null;
  revokeTarget: IamAssignment | null;
  deletePolicyTarget: IamPolicyRule | null;
  isSubmitting: boolean;
  onCloseDeleteRole: () => void;
  onCloseUnbind: () => void;
  onCloseRevoke: () => void;
  onCloseDeletePolicy: () => void;
  onConfirmDeleteRole: () => void;
  onConfirmUnbind: () => void;
  onConfirmRevoke: () => void;
  onConfirmDeletePolicy: () => void;
}

/** Keempat ConfirmationDialog AccessControl dalam satu file. */
export const AccessControlConfirmDialogs: React.FC<AccessControlConfirmDialogsProps> = ({
  deleteRoleTarget,
  unbindTarget,
  revokeTarget,
  deletePolicyTarget,
  isSubmitting,
  onCloseDeleteRole,
  onCloseUnbind,
  onCloseRevoke,
  onCloseDeletePolicy,
  onConfirmDeleteRole,
  onConfirmUnbind,
  onConfirmRevoke,
  onConfirmDeletePolicy,
}) => {
  return (
    <>
      <ConfirmationDialog
        isOpen={Boolean(deleteRoleTarget)}
        onClose={onCloseDeleteRole}
        onConfirm={onConfirmDeleteRole}
        title={`Hapus Custom Role ${deleteRoleTarget?.name ?? ''}?`}
        variant="destructive"
        description={`Menghapus custom role "${deleteRoleTarget?.name ?? ''}" akan menghapus seluruh binding policy yang terkait dengan role tersebut.`}
        impacts={[
          'Penghapusan ditolak (409 ROLE_IN_USE) jika role masih ditugaskan ke operator.',
          'authz_version dinaikkan secara otomatis.',
        ]}
        confirmLabel="Ya, Hapus Role"
        isLoading={isSubmitting}
      />

      <ConfirmationDialog
        isOpen={Boolean(unbindTarget)}
        onClose={onCloseUnbind}
        onConfirm={onConfirmUnbind}
        title={`Cabut Permission ${unbindTarget?.label ?? ''}?`}
        variant="destructive"
        description={`Permission "${unbindTarget?.label ?? ''}" akan dilepas dari role "${unbindTarget?.role.name ?? ''}".`}
        impacts={[
          'Operator dengan role ini segera kehilangan akses terkait dalam mode enforce.',
          'authz_version dinaikkan dan sesi token lama dapat berakhir (401).',
        ]}
        confirmLabel="Ya, Cabut Permission"
        isLoading={isSubmitting}
      />

      <ConfirmationDialog
        isOpen={Boolean(revokeTarget)}
        onClose={onCloseRevoke}
        onConfirm={onConfirmRevoke}
        title={`Cabut Role ${revokeTarget?.role_name ?? ''} dari ${revokeTarget?.operator_id ?? ''}?`}
        variant="destructive"
        description={`Penugasan role ${revokeTarget?.role_name ?? ''} (scope ${revokeTarget?.scope_type ?? ''}) pada ${revokeTarget?.operator_name ?? ''} akan dicabut.`}
        impacts={[
          'Operator akan kembali menggunakan primary role atau sisa assignment yang masih aktif.',
          'authz_version dinaikkan secara otomatis.',
        ]}
        confirmLabel="Ya, Cabut Assignment"
        isLoading={isSubmitting}
      />

      <ConfirmationDialog
        isOpen={Boolean(deletePolicyTarget)}
        onClose={onCloseDeletePolicy}
        onConfirm={onConfirmDeletePolicy}
        title={`Hapus Policy ${deletePolicyTarget?.id ?? ''}?`}
        variant="destructive"
        description={`Aturan ${deletePolicyTarget?.eft ?? ''} (${deletePolicyTarget?.action ?? ''} → ${deletePolicyTarget?.resource_pattern ?? ''}) untuk role ${deletePolicyTarget?.role ?? ''} akan dihapus permanen.`}
        impacts={['authz_version dinaikkan setelah policy dihapus.']}
        confirmLabel="Ya, Hapus Policy"
        isLoading={isSubmitting}
      />
    </>
  );
};
