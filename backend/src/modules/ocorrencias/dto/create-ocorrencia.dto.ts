// create-ocorrencia.dto.ts
import {
  IsString, IsNotEmpty, IsNumber, IsOptional, IsUUID,
  Min, Max, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOcorrenciaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  descricao: string;

  @IsOptional()
  @IsUUID()
  categoria_id?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90) @Max(90)
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180) @Max(180)
  longitude: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  endereco?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  client_id?: string;   // UUID offline-first gerado no app
}
