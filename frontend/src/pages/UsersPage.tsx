import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Eye, KeyRound, Loader2, Plus, Shield, Trash2, UserRound, Users } from 'lucide-react';
import { useAuth, type Role } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/library/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorDialog } from '@/components/ui/error-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { deleteUser, listUsers, updateUser, type AppUser } from '@/lib/users-api';
import { createInvite, createResetLink, inviteUrl } from '@/lib/invites-api';
import { cn } from '@/lib/utils';

/**
 * `/usuarios` — quem entra no site e o que pode fazer.
 *
 * Só administradores chegam aqui (o menu esconde e o Worker recusa). São dois
 * papéis: **administrador**, que faz tudo, e **somente leitura**, que consome o
 * site e monta as próprias playlists.
 *
 * Ninguém aqui escolhe a senha de outra pessoa: uma conta nova nasce por
 * convite, e trocar a senha de uma que já existe é um link — em ambos, quem
 * abre o link é quem escolhe a senha.
 */
export function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<AppUser | null>(null);
  const [link, setLink] = useState<{ title: string; description: string; url: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    try {
      setUsers(await listUsers());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar as contas.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleResetLink = async (account: AppUser) => {
    try {
      const { token } = await createResetLink(account.id);
      setLink({
        title: `Link para ${account.name} trocar a senha`,
        description: 'Vale por 24 horas e uma vez só. Mande por onde quiser.',
        url: inviteUrl(token),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar o link.');
    }
  };

  return (
    <>
      <PageHeader
        title="Usuários"
        icon={Users}
        contentWidth="max-w-3xl"
        subtitle={
          users ? `${users.length} ${users.length === 1 ? 'conta' : 'contas'}` : 'Carregando…'
        }
        actions={
          <Button variant="gold" size="sm" className="gap-1.5" onClick={() => setInviting(true)}>
            <Plus className="size-4" /> <span className="hidden sm:inline">Convidar</span>
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
        {!users ? (
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhuma conta ainda"
            description="Convide quem vai tocar com você."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {users.map((account) => (
              <li
                key={account.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-soft"
              >
                <span
                  className={cn(
                    'grid size-11 shrink-0 place-items-center rounded-full',
                    account.role === 'admin'
                      ? 'bg-[image:var(--gradient-gold)] text-navy-900'
                      : 'bg-navy-700 text-gold-300',
                  )}
                >
                  {account.role === 'admin' ? (
                    <Shield className="size-5" />
                  ) : (
                    <UserRound className="size-5" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">
                    {account.name}
                    {account.id === me?.id && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">(você)</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{account.email}</p>
                  <RoleBadge role={account.role} className="mt-1" />
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void handleResetLink(account)}
                  aria-label={`Gerar link para ${account.name} trocar a senha`}
                  title="Gerar link para trocar a senha"
                >
                  <KeyRound className="size-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(account)}>
                  Editar
                </Button>
                <button
                  type="button"
                  onClick={() => setRemoving(account)}
                  disabled={account.id === me?.id}
                  aria-label={`Excluir ${account.name}`}
                  title={
                    account.id === me?.id ? 'Você não pode excluir a própria conta' : 'Excluir conta'
                  }
                  className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {inviting && (
        <InviteDialog
          onClose={() => setInviting(false)}
          onCreated={(token, email) => {
            setInviting(false);
            setLink({
              title: `Convite para ${email}`,
              description: 'Vale por 7 dias e uma vez só. Mande por onde quiser.',
              url: inviteUrl(token),
            });
          }}
        />
      )}

      {editing && (
        <EditDialog
          account={editing}
          isMe={editing.id === me?.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}

      {removing && (
        <DeleteDialog
          account={removing}
          onClose={() => setRemoving(null)}
          onDeleted={() => {
            setRemoving(null);
            void load();
          }}
        />
      )}

      {link && (
        <LinkDialog
          title={link.title}
          description={link.description}
          url={link.url}
          onClose={() => setLink(null)}
        />
      )}

      <ErrorDialog message={error} onClose={() => setError(null)} />
    </>
  );
}

function RoleBadge({ role, className }: { role: Role; className?: string }) {
  const admin = role === 'admin';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        admin
          ? 'border-gold-500/40 bg-[color-mix(in_srgb,var(--color-gold-400)_12%,transparent)] text-gold-700 dark:text-gold-400'
          : 'border-[var(--color-outline)] text-muted-foreground',
        className,
      )}
    >
      {admin ? <Shield className="size-3" /> : <Eye className="size-3" />}
      {admin ? 'Administrador' : 'Somente leitura'}
    </span>
  );
}

/** Convidar: só e-mail, nome e papel — quem aceita o convite escolhe a senha. */
function InviteDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (token: string, email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('leitor');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const podeEnviar = email.includes('@') && name.trim() !== '';

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const trimmedEmail = email.trim();
      const { token } = await createInvite({ email: trimmedEmail, name: name.trim(), role });
      onCreated(token, trimmedEmail);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar o convite.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convidar para o site</DialogTitle>
          <DialogDescription>
            Você diz o e-mail, o nome e o que a pessoa pode fazer; ela escolhe a própria senha ao
            abrir o link.
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label htmlFor="invite-email" className="mb-1.5 block text-sm">
            E-mail
          </Label>
          <Input
            id="invite-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pessoa@exemplo.com"
          />
        </div>

        <div>
          <Label htmlFor="invite-name" className="mb-1.5 block text-sm">
            Nome
          </Label>
          <Input
            id="invite-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como aparece no app"
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-foreground">O que pode fazer</legend>
          <RoleOption
            value="admin"
            current={role}
            onChange={setRole}
            title="Administrador"
            description="Cria, edita, importa e exclui músicas — e cuida das contas."
          />
          <RoleOption
            value="leitor"
            current={role}
            onChange={setRole}
            title="Somente leitura"
            description="Abre a biblioteca, toca e monta as próprias playlists."
          />
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={!podeEnviar || saving} className="gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}
            Criar convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Editar uma conta que já existe: nome e papel. A senha é só de quem usa. */
function EditDialog({
  account,
  isMe,
  onClose,
  onSaved,
}: {
  account: AppUser;
  isMe: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(account.name);
  const [role, setRole] = useState<Role>(account.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const podeSalvar = name.trim() !== '';

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateUser(account.id, { name: name.trim(), role });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar conta</DialogTitle>
          <DialogDescription>{account.email}</DialogDescription>
        </DialogHeader>

        <div>
          <Label htmlFor="user-name" className="mb-1.5 block text-sm">
            Nome
          </Label>
          <Input
            id="user-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como aparece no app"
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-foreground">O que pode fazer</legend>
          <RoleOption
            value="admin"
            current={role}
            onChange={setRole}
            disabled={isMe}
            title="Administrador"
            description="Cria, edita, importa e exclui músicas — e cuida das contas."
          />
          <RoleOption
            value="leitor"
            current={role}
            onChange={setRole}
            disabled={isMe}
            title="Somente leitura"
            description="Abre a biblioteca, toca e monta as próprias playlists."
          />
          {isMe && (
            <p className="text-xs text-muted-foreground">
              Você não pode tirar o próprio acesso de administrador.
            </p>
          )}
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={!podeSalvar || saving} className="gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleOption({
  value,
  current,
  onChange,
  disabled,
  title,
  description,
}: {
  value: Role;
  current: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
  title: string;
  description: string;
}) {
  const selected = current === value;
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
        selected ? 'border-gold-500 bg-[color-mix(in_srgb,var(--color-gold-400)_10%,transparent)]' : 'border-border hover:border-[var(--color-outline)]',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        type="radio"
        name="papel"
        className="mt-1 accent-[var(--color-gold-500)]"
        checked={selected}
        disabled={disabled}
        onChange={() => onChange(value)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

/** Mostra um link de convite/redefinir, pronto para copiar e mandar por fora. */
function LinkDialog({
  title,
  description,
  url,
  onClose,
}: {
  title: string;
  description: string;
  url: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponível */
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => void copy()}
            aria-label="Copiar o link"
            title="Copiar o link"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Concluído</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  account,
  onClose,
  onDeleted,
}: {
  account: AppUser;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setSaving(true);
    setError(null);
    try {
      await deleteUser(account.id);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível excluir.');
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir a conta de {account.name}?</DialogTitle>
          <DialogDescription>
            Ela perde o acesso ao site na hora, e as playlists dela são apagadas. As músicas da
            biblioteca não são afetadas.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void remove()} disabled={saving} className="gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}
            Excluir conta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
