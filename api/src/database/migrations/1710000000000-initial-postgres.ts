import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialPostgres1710000000000 implements MigrationInterface {
  name = 'InitialPostgres1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name varchar UNIQUE NOT NULL,
        description varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name varchar UNIQUE NOT NULL,
        description varchar NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name varchar UNIQUE NOT NULL,
        description varchar
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        "roleId" uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        "permissionId" uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY ("roleId", "permissionId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        email varchar UNIQUE NOT NULL,
        password varchar NOT NULL,
        name varchar NOT NULL,
        "firstName" varchar NOT NULL,
        "lastName" varchar NOT NULL,
        "roleId" uuid NOT NULL REFERENCES roles(id),
        "organizationId" uuid NOT NULL REFERENCES organizations(id),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name varchar NOT NULL,
        description varchar,
        "organizationId" uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        title varchar NOT NULL,
        description text NOT NULL,
        status varchar NOT NULL DEFAULT 'pending',
        priority varchar NOT NULL DEFAULT 'medium',
        "dueDate" timestamptz,
        "budgetHours" double precision NOT NULL DEFAULT 0,
        "actualHours" double precision NOT NULL DEFAULT 0,
        "completionPercent" double precision NOT NULL DEFAULT 0,
        "assignedToId" uuid REFERENCES users(id),
        "createdById" uuid REFERENCES users(id),
        "organizationId" uuid NOT NULL REFERENCES organizations(id),
        "projectId" uuid REFERENCES projects(id),
        "parentTaskId" uuid REFERENCES tasks(id) ON DELETE SET NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS task_dependencies (
        "taskId" uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        "dependsOnTaskId" uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        PRIMARY KEY ("taskId", "dependsOnTaskId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        action varchar NOT NULL,
        resource varchar NOT NULL,
        "resourceId" varchar,
        "userId" uuid REFERENCES users(id),
        "ipAddress" varchar,
        "userAgent" varchar,
        metadata jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS audit_logs');
    await queryRunner.query('DROP TABLE IF EXISTS task_dependencies');
    await queryRunner.query('DROP TABLE IF EXISTS tasks');
    await queryRunner.query('DROP TABLE IF EXISTS projects');
    await queryRunner.query('DROP TABLE IF EXISTS users');
    await queryRunner.query('DROP TABLE IF EXISTS role_permissions');
    await queryRunner.query('DROP TABLE IF EXISTS roles');
    await queryRunner.query('DROP TABLE IF EXISTS permissions');
    await queryRunner.query('DROP TABLE IF EXISTS organizations');
  }
}

