import { IRole } from './role.interface';
import { IOrganization } from './organization.interface';

export interface IUser {
  id: string;
  email: string;
  username?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  roleId?: string;
  role?: IRole;
  organizationId?: string;
  organization?: IOrganization;
  createdAt: Date;
  updatedAt: Date;
}
