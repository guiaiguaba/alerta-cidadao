// update-ocorrencia.dto.ts
import { IsOptional, IsIn, IsUUID, IsString, MaxLength } from 'class-validator';

export class UpdateOcorrenciaDto {
  @IsOptional()
  @IsIn(['aberta', 'em_andamento', 'resolvida', 'cancelada'])
  status?: string;

  @IsOptional()
  @IsIn(['baixa', 'normal', 'alta', 'critica'])
  prioridade?: string;

  @IsOptional()
  @IsUUID()
  agent_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolucao_nota?: string;
}
