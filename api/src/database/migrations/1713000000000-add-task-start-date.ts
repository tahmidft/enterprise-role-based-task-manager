import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskStartDate1713000000000 implements MigrationInterface {
  name = 'AddTaskStartDate1713000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "startDate" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN IF EXISTS "startDate"`);
  }
}
