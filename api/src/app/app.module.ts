import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { databaseConfig } from '../config/database.config';
import { AuthModule } from '../auth/auth.module';
import { SeedModule } from '../database/seeds/seed.module';
import { TasksModule } from '../tasks/tasks.module';  // Add this

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig),
    AuthModule,
    SeedModule,
    TasksModule,  // Add this
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}