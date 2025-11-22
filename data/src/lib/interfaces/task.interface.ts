import { IUser } from './user.interface';
import { IOrganization } from './organization.interface';

export interface ITask {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedTo?: IUser;
  createdBy?: IUser;
  organization?: IOrganization;
  dueDate?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
