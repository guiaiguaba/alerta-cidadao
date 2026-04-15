import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SyncUserDto {
  @IsString()
  @IsNotEmpty()
  id_token: string;

  @IsOptional()
  @IsString()
  fcm_token?: string;
}
