export class CreateTaskDto {
  title!: string;
  description!: string;
  status?: string;
  priority!: string;
  assignedToId!: string;
}

export class UpdateTaskDto {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assignedToId?: string;
}
