import { Injectable } from '@nestjs/common';

const PALAVRAS_CRITICAS = [
  'enchente','inundação','incêndio','fogo','desabamento','deslizamento',
  'explosão','acidente grave','morte','óbito','emergência','socorro urgente',
];

const PALAVRAS_ALTA = [
  'buraco','cratera','poste','fio','esgoto','vazamento','obra',
  'risco','perigoso','perigo','urgente',
];

@Injectable()
export class PrioridadeService {
  calcular(descricao: string): 'baixa' | 'normal' | 'alta' | 'critica' {
    const lower = descricao.toLowerCase();

    if (PALAVRAS_CRITICAS.some((w) => lower.includes(w))) return 'critica';
    if (PALAVRAS_ALTA.some((w) => lower.includes(w))) return 'alta';

    return 'normal';
  }
}
