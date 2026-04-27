// src/lib/utils/__tests__/utils.spec.ts
import {
  formatMinutes,
  formatNumber,
  formatRelative,
  getPriorityClass,
  getStatusClass,
  getSlaStatus,
  getInitials,
  truncate,
  getRoleLabel,
  STATUS_LABELS,
  PRIORITY_LABELS,
} from '../index';

describe('formatMinutes()', () => {
  it('deve formatar minutos menores que 60', () => {
    expect(formatMinutes(30)).toBe('30min');
    expect(formatMinutes('45')).toBe('45min');
  });

  it('deve formatar horas completas', () => {
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(120)).toBe('2h');
  });

  it('deve formatar horas + minutos', () => {
    expect(formatMinutes(90)).toBe('1h 30min');
    expect(formatMinutes(150)).toBe('2h 30min');
  });

  it('deve retornar — para valores inválidos', () => {
    expect(formatMinutes(NaN)).toBe('—');
    expect(formatMinutes('abc')).toBe('—');
  });

  it('deve tratar string numérica', () => {
    expect(formatMinutes('180')).toBe('3h');
  });
});

describe('formatNumber()', () => {
  it('deve formatar número com separador pt-BR', () => {
    expect(formatNumber(1000)).toBe('1.000');
    expect(formatNumber(1000000)).toBe('1.000.000');
  });

  it('deve aceitar string numérica', () => {
    expect(formatNumber('500')).toBe('500');
  });
});

describe('getPriorityClass()', () => {
  it('deve retornar classe CSS correta para cada prioridade', () => {
    expect(getPriorityClass('critical')).toBe('badge-critical');
    expect(getPriorityClass('high')).toBe('badge-high');
    expect(getPriorityClass('medium')).toBe('badge-medium');
    expect(getPriorityClass('low')).toBe('badge-low');
  });
});

describe('getStatusClass()', () => {
  it('deve retornar classe CSS correta para cada status', () => {
    expect(getStatusClass('open')).toBe('badge-open');
    expect(getStatusClass('resolved')).toBe('badge-resolved');
    expect(getStatusClass('in_progress')).toBe('badge-in_progress');
  });
});

describe('getSlaStatus()', () => {
  it('deve retornar null sem deadline', () => {
    expect(getSlaStatus(undefined, false)).toBeNull();
  });

  it('deve retornar violado quando slaBreached=true', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const result = getSlaStatus(future, true);
    expect(result?.label).toBe('Violado');
    expect(result?.color).toBe('text-critical');
  });

  it('deve retornar violado quando prazo já passou', () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    const result = getSlaStatus(past, false);
    expect(result?.label).toBe('Violado');
  });

  it('deve retornar aviso quando falta menos de 15 minutos', () => {
    const soon = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const result = getSlaStatus(soon, false);
    expect(result?.color).toBe('text-high');
  });

  it('deve retornar status ok quando há bastante tempo', () => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const result = getSlaStatus(future, false);
    expect(result?.color).toBe('text-low');
    expect(result?.pct).toBe(30);
  });
});

describe('getInitials()', () => {
  it('deve retornar iniciais de nome completo', () => {
    expect(getInitials('João da Silva')).toBe('JS');
  });

  it('deve retornar iniciais de nome simples', () => {
    expect(getInitials('Maria')).toBe('MA');
  });

  it('deve retornar em maiúsculas', () => {
    expect(getInitials('pedro henrique')).toBe('PH');
  });
});

describe('truncate()', () => {
  it('deve truncar string longa', () => {
    expect(truncate('Texto muito longo para caber aqui', 15)).toBe('Texto muito lon…');
  });

  it('deve retornar string curta intacta', () => {
    expect(truncate('Texto curto', 20)).toBe('Texto curto');
  });

  it('deve truncar exatamente no limite', () => {
    const str = 'ABCDE';
    expect(truncate(str, 5)).toBe('ABCDE');
    expect(truncate(str, 4)).toBe('ABCD…');
  });
});

describe('getRoleLabel()', () => {
  it('deve retornar label em português', () => {
    expect(getRoleLabel('citizen')).toBe('Cidadão');
    expect(getRoleLabel('agent')).toBe('Agente');
    expect(getRoleLabel('supervisor')).toBe('Supervisor');
    expect(getRoleLabel('admin')).toBe('Administrador');
  });

  it('deve retornar o próprio role se não mapeado', () => {
    expect(getRoleLabel('unknown_role')).toBe('unknown_role');
  });
});

describe('STATUS_LABELS', () => {
  it('deve ter label para todos os status', () => {
    const statuses = ['open', 'assigned', 'in_progress', 'resolved', 'rejected', 'duplicate'];
    statuses.forEach(s => {
      expect(STATUS_LABELS[s as keyof typeof STATUS_LABELS]).toBeDefined();
    });
  });
});

describe('PRIORITY_LABELS', () => {
  it('deve ter label para todas as prioridades', () => {
    const priorities = ['critical', 'high', 'medium', 'low'];
    priorities.forEach(p => {
      expect(PRIORITY_LABELS[p as keyof typeof PRIORITY_LABELS]).toBeDefined();
    });
  });
});
