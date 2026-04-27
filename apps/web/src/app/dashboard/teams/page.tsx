'use client';
import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { teamsApi, usersApi } from '@/lib/api/client';
import { Team, User } from '@/types';
import { getInitials, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Plus, Pencil, Trash2, UserPlus, UserMinus,
  UsersRound, X, ChevronDown, ChevronRight, MapPin,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function TeamsPage() {
  const [teams,      setTeams]      = useState<Team[]>([]);
  const [users,      setUsers]      = useState<User[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTeam,   setEditTeam]   = useState<Team | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [t, u] = await Promise.all([teamsApi.list(), usersApi.list()]);
      setTeams(t);
      setUsers(u.filter((u: User) => ['agent', 'supervisor'].includes(u.role)));
    } catch { toast.error('Erro ao carregar equipes'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleDeactivate(id: string) {
    if (!confirm('Desativar esta equipe?')) return;
    try {
      await teamsApi.update(id, { isActive: false });
      setTeams(prev => prev.filter(t => t.id !== id));
      toast.success('Equipe desativada');
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleAddMember(teamId: string, userId: string, role = 'member') {
    try {
      await teamsApi.addMember(teamId, userId, role);
      await load();
      toast.success('Membro adicionado');
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleRemoveMember(teamId: string, userId: string) {
    try {
      await teamsApi.removeMember(teamId, userId);
      setTeams(prev => prev.map(t =>
        t.id === teamId
          ? { ...t, members: t.members.filter(m => m.id !== userId), memberCount: t.memberCount - 1 }
          : t
      ));
      toast.success('Membro removido');
    } catch (err: any) { toast.error(err.message); }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Equipes"
        subtitle={`${teams.length} equipe(s) ativa(s)`}
        actions={
          <button onClick={() => setShowCreate(true)} className="btn-primary text-xs">
            <Plus className="w-3.5 h-3.5" /> Nova Equipe
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 panel animate-pulse" />
            ))}
          </div>
        ) : teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-tertiary">
            <UsersRound className="w-8 h-8 mb-3 opacity-30" />
            <p className="font-mono text-sm">Nenhuma equipe criada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {teams.map(team => {
              const expanded = expandedId === team.id;
              const memberIds = new Set(team.members?.map(m => m.id) ?? []);
              const availableUsers = users.filter(u => !memberIds.has(u.id));

              return (
                <div key={team.id} className="panel overflow-hidden">
                  {/* Team header */}
                  <div
                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => setExpandedId(expanded ? null : team.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <UsersRound className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="font-medium text-primary">{team.name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-2xs font-mono text-tertiary">
                            {team.memberCount} membro(s)
                          </span>
                          {team.regionCodes?.length > 0 && (
                            <span className="text-2xs font-mono text-tertiary flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {team.regionCodes.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={e => { e.stopPropagation(); setEditTeam(team); }}
                        className="btn-ghost text-xs p-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeactivate(team.id); }}
                        className="btn-ghost text-xs p-1.5 text-tertiary hover:text-critical"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {expanded
                        ? <ChevronDown className="w-4 h-4 text-tertiary" />
                        : <ChevronRight className="w-4 h-4 text-tertiary" />
                      }
                    </div>
                  </div>

                  {/* Expanded members */}
                  {expanded && (
                    <div className="border-t border-border">
                      {/* Members list */}
                      <div className="divide-y divide-border/50">
                        {(team.members ?? []).map(m => (
                          <div key={m.id} className="flex items-center justify-between px-5 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-md bg-muted border border-border flex items-center justify-center">
                                <span className="text-2xs font-mono font-bold text-secondary">
                                  {getInitials(m.name)}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm text-primary">{m.name}</p>
                                <p className="text-2xs font-mono text-tertiary capitalize">{m.role}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveMember(team.id, m.id)}
                              className="btn-ghost text-xs p-1 text-tertiary hover:text-critical"
                              title="Remover"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add member */}
                      {availableUsers.length > 0 && (
                        <div className="px-5 py-3 bg-muted/20 border-t border-border flex items-center gap-2">
                          <UserPlus className="w-3.5 h-3.5 text-tertiary" />
                          <select
                            className="select text-xs flex-1 max-w-xs"
                            defaultValue=""
                            onChange={e => {
                              if (e.target.value) {
                                handleAddMember(team.id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                          >
                            <option value="" disabled>Adicionar membro...</option>
                            {availableUsers.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.role})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {(showCreate || editTeam) && (
        <TeamModal
          team={editTeam}
          onClose={() => { setShowCreate(false); setEditTeam(null); }}
          onSaved={async (data) => {
            try {
              if (editTeam) {
                const updated = await teamsApi.update(editTeam.id, data);
                setTeams(prev => prev.map(t => t.id === editTeam.id ? updated : t));
                toast.success('Equipe atualizada');
              } else {
                const created = await teamsApi.create(data);
                setTeams(prev => [created, ...prev]);
                toast.success('Equipe criada');
              }
              setShowCreate(false);
              setEditTeam(null);
            } catch (err: any) {
              toast.error(err.message);
            }
          }}
        />
      )}
    </div>
  );
}

function TeamModal({
  team, onClose, onSaved,
}: {
  team:    Team | null;
  onClose: () => void;
  onSaved: (data: any) => Promise<void>;
}) {
  const [name,        setName]        = useState(team?.name ?? '');
  const [description, setDescription] = useState(team?.description ?? '');
  const [regions,     setRegions]     = useState(team?.regionCodes?.join(', ') ?? '');
  const [saving,      setSaving]      = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSaved({
      name,
      description:  description || undefined,
      regionCodes:  regions ? regions.split(',').map(r => r.trim()).filter(Boolean) : [],
    }).finally(() => setSaving(false));
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="panel w-full max-w-md shadow-panel">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-medium text-primary">
              {team ? 'Editar Equipe' : 'Nova Equipe'}
            </h2>
            <button onClick={onClose} className="btn-ghost p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="data-label block mb-1.5">Nome *</label>
              <input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="input"
                placeholder="Ex: Equipe Alpha - Centro"
              />
            </div>
            <div>
              <label className="data-label block mb-1.5">Descrição</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="input resize-none"
                placeholder="Descrição opcional..."
              />
            </div>
            <div>
              <label className="data-label block mb-1.5">Regiões de Atuação</label>
              <input
                value={regions}
                onChange={e => setRegions(e.target.value)}
                className="input"
                placeholder="centro, norte, sul (separadas por vírgula)"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary text-xs">Cancelar</button>
              <button type="submit" disabled={saving} className="btn-primary text-xs">
                {saving ? 'Salvando...' : team ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
