import { SetMetadata } from '@nestjs/common';
import { RbacRole } from '../rbac.config';

export const ROLES_KEY = 'rbac:roles';

export const Roles = (...roles: RbacRole[]) => SetMetadata(ROLES_KEY, roles);
