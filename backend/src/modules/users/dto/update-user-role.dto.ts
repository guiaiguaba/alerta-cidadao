import { IsIn } from 'class-validator';

export class UpdateUserRoleDto {
  @IsIn(['citizen', 'agent', 'admin'])
  role: string;
}
