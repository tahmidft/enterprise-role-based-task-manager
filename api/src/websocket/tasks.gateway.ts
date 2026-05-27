import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Task } from '../entities/task.entity';

export type TaskEvent =
  | 'task:created'
  | 'task:updated'
  | 'task:deleted'
  | 'task:assigned';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/tasks',
})
export class TasksGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TasksGateway.name);

  constructor(
    private jwtService: JwtService,
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.['token'] as string | undefined) ??
        (client.handshake.headers?.['authorization'] as string | undefined)
          ?.replace('Bearer ', '');

      if (!token) throw new UnauthorizedException('No token');

      const payload = this.jwtService.verify<{ sub: string }>(token);
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        relations: ['role'],
      });

      if (!user) throw new UnauthorizedException('User not found');

      client.data['user'] = user;
      client.join(`org:${user.organizationId}`);
      this.logger.log(`Client connected: ${user.email}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data['user'] as User | undefined;
    if (user) {
      this.logger.log(`Client disconnected: ${user.email}`);
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() data: unknown) {
    return { event: 'pong', data };
  }

  emitTaskEvent(
    event: TaskEvent,
    task: Task,
    organizationId: string,
  ): void {
    this.server.to(`org:${organizationId}`).emit(event, task);
  }
}
