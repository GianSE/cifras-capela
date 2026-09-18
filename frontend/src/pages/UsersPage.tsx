import { useCallback, useEffect, useState } from 'react';
import { Eye, Loader2, Plus, Shield, Trash2, UserRound, Users } from 'lucide-react';
import { useAuth, type Role } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/library/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  type AppUser,
} from '@/lib/users-api';
import { cn } from '@/lib/utils';

const MIN_PASSWORD = 8;

/**
 * `/usuarios` — quem entra no site e o que pode fazer.
 *
 * Só administradores chegam aqui (o menu esconde e o Worker recusa). São dois
 * papéis: **administrador**, que faz tudo, e **somente leitura**, que consome o
 * site e monta as próprias playlists.
 */
export function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AppUser | 'novo' | null>(null);
  const [removing, setRemoving] = useState<AppUser | null>(null);

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
          <Button variant="gold" size="sm" className="gap-1.5" onClick={() => setEditing('novo')}>
            <Plus className="size-4" /> <span className="hidden sm:inline">Nova conta</span>
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

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
            description="Crie a conta de quem vai tocar com você."
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

      {editing && (
        <UserDialog
          account={editing === 'novo' ? null : editing}
          isMe={editing !== 'novo' && editing.id === me?.id}
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

/** Criar (sem `account`) ou editar uma conta. */
function UserDialog({
  account,
  isMe,
  onClose,
  onSaved,
}: {
  account: AppUser | null;
  isMe: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState(account?.email ?? '');
  const [name, setName] = useState(account?.name ?? '');
  const [role, setRole] = useState<Role>(account?.role ?? 'leitor');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const novo = account === null;
  const senhaCurta = password !== '' && password.length < MIN_PASSWORD;
  const podeSalvar =
    name.trim() !== '' &&
    !senhaCurta &&
    (!novo || (email.includes('@') && password.length >= MIN_PASSWORD));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (novo) {
        await createUser({ email: email.trim(), name: name.trim(), role, password });
      } else {
        await updateUser(account.id, {
          name: name.trim(),
          role,
          ...(password ? { password } : {}),
        });
      }
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
          <DialogTitle>{novo ? 'Nova conta' : 'Editar conta'}</DialogTitle>
          <DialogDescription>
            {novo
              ? 'A pessoa entra com este e-mail e senha. Você pode trocar os dois depois.'
              : 'Deixe a senha em branco para manter a atual.'}
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label htmlFor="user-email" className="mb-1.5 block text-sm">
            E-mail
          </Label>
          <Input
            id="user-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            disabled={!novo}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pessoa@exemplo.com"
          />
          {!novo && (
            <p className="mt-1 text-xs text-muted-foreground">
              O e-mail é a identidade da conta e não muda.
            </p>
          )}
        </div>

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

        <div>
          <Label htmlFor="user-password" className="mb-1.5 block text-sm">
            {novo ? 'Senha' : 'Nova senha (opcional)'}
          </Label>
          <Input
            id="user-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`Pelo menos ${MIN_PASSWORD} caracteres`}
            aria-invalid={senhaCurta}
          />
          {senhaCurta && (
            <p className="mt-1 text-xs text-destructive">
              A senha precisa de pelo menos {MIN_PASSWORD} caracteres.
            </p>
          )}
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
            {novo ? 'Criar conta' : 'Salvar'}
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
