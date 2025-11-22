export interface IUser {
  id: number;
  email: string;
  role: IRole;
  organization: IOrganization;
  createdAt: Date;
}

export interface IRole {
  id: number;
  name: 'Owner' | 'Admin' | 'Viewer';
  description?: string;
}

export interface IOrganization {
  id: number;
  name: string;
  description?: string;
  parentId?: number;
  parent?: IOrganization;
  children?: IOrganization[];
}

export interface ITask {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  category?: string;
  creatorId: number;
  organizationId: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface IAuditLog {
  id: number;
  userId: number;
  action: string;
  resource: string;
  resourceId: number;
  timestamp: Date;
  details?: string;
}
