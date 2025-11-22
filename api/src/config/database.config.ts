import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'sqlite',
  database: 'data/recruitment-app.db',
  entities: ['dist/api/**/*.entity.js'],
  synchronize: true, // Auto-create tables (dev only!)
  logging: false,
};
