import { PrioridadeService } from './prioridade.service';

describe('PrioridadeService', () => {
  let svc: PrioridadeService;

  beforeEach(() => { svc = new PrioridadeService(); });

  it('should return "critica" for enchente', () => {
    expect(svc.calcular('Rua inundada por causa da enchente')).toBe('critica');
  });

  it('should return "critica" for incêndio', () => {
    expect(svc.calcular('Tem um incêndio no prédio!')).toBe('critica');
  });

  it('should return "alta" for buraco', () => {
    expect(svc.calcular('Enorme buraco na calçada')).toBe('alta');
  });

  it('should return "alta" for urgente', () => {
    expect(svc.calcular('Situação urgente no bairro')).toBe('alta');
  });

  it('should return "normal" for generic description', () => {
    expect(svc.calcular('Limpeza necessária na rua')).toBe('normal');
  });

  it('should be case-insensitive', () => {
    expect(svc.calcular('ENCHENTE NA AVENIDA')).toBe('critica');
  });
});
