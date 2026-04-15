import { IsOptional, IsIn, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListOcorrenciasDto {
  @IsOptional()
  @IsIn(['aberta', 'em_andamento', 'resolvida', 'cancelada'])
  status?: string;

  @IsOptional()
  @IsIn(['baixa', 'normal', 'alta', 'critica'])
  prioridade?: string;

  @IsOptional()
  @IsUUID()
  categoria_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
