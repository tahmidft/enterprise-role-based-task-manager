import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserRefreshTokenColumns1711000000000
  implements MigrationInterface
{
  name = 'AddUserRefreshTokenColumns1711000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('users', [
      new TableColumn({
        name: 'refreshToken',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'refreshTokenExpiry',
        type: 'timestamptz',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'refreshTokenExpiry');
    await queryRunner.dropColumn('users', 'refreshToken');
  }
}
