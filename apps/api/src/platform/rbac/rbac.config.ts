export type RbacRole = 'owner' | 'admin' | 'member';

export interface RbacModuleConfig {
  defaultRole: RbacRole;
}

export const RBAC_ROLE_HIERARCHY: Record<RbacRole, number> = {
  member: 0,
  admin: 1,
  owner: 2,
};

export const RBAC_MODULE_CONFIG = 'RBAC_MODULE_CONFIG';
