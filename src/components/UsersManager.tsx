"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";

type UserRow = {
  id: string;
  login: string;
  role: string;
  blocked: boolean;
  createdAt: string | Date;
};

export function UsersManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [passwordUser, setPasswordUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const adminCount = useMemo(
    () => users.filter((u) => u.role === "admin" && !u.blocked).length,
    [users],
  );

  async function refresh() {
    router.refresh();
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось создать");
      setLogin("");
      setPassword("");
      setRole("user");
      setMessage(`Пользователь ${data.user.login} создан`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function patchUser(id: string, body: Record<string, unknown>) {
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Ошибка сохранения");
    await refresh();
    return data;
  }

  async function toggleBlock(user: UserRow) {
    try {
      await patchUser(user.id, { blocked: !user.blocked });
      setMessage(
        user.blocked
          ? `Пользователь ${user.login} разблокирован`
          : `Пользователь ${user.login} заблокирован`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function removeUser(user: UserRow) {
    if (!window.confirm(`Удалить пользователя ${user.login}?`)) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось удалить");
      setMessage(`Пользователь ${user.login} удалён`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordUser) return;
    setSaving(true);
    setError(null);
    try {
      await patchUser(passwordUser.id, { password: newPassword });
      setMessage(`Пароль для ${passwordUser.login} обновлён`);
      setPasswordUser(null);
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={createUser}
        className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-[1fr_1fr_140px_auto]"
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">Логин</span>
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            className="field"
            placeholder="manager"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
            required
            minLength={6}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">Роль</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "user" | "admin")}
            className="field"
          >
            <option value="user">Пользователь</option>
            <option value="admin">Админ</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:brightness-95 disabled:opacity-60"
          >
            {saving ? "Сохранение…" : "Добавить"}
          </button>
        </div>
      </form>

      {message ? <p className="text-sm text-[#1a7f37]">{message}</p> : null}
      {error ? <p className="text-sm text-[#c62828]">{error}</p> : null}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Логин</th>
              <th>Роль</th>
              <th>Статус</th>
              <th>Создан</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const lastAdmin =
                user.role === "admin" && !user.blocked && adminCount <= 1;
              return (
                <tr key={user.id}>
                  <td className="font-medium">
                    {user.login}
                    {isSelf ? (
                      <span className="ml-2 text-xs text-[var(--muted)]">вы</span>
                    ) : null}
                  </td>
                  <td>{user.role === "admin" ? "Админ" : "Пользователь"}</td>
                  <td>{user.blocked ? "Заблокирован" : "Активен"}</td>
                  <td>{formatDateTime(user.createdAt)}</td>
                  <td className="text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordUser(user);
                          setNewPassword("");
                          setError(null);
                        }}
                        className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs hover:bg-[var(--surface)]"
                      >
                        Пароль
                      </button>
                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => toggleBlock(user)}
                        className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs hover:bg-[var(--surface)] disabled:opacity-40"
                      >
                        {user.blocked ? "Разблокировать" : "Заблокировать"}
                      </button>
                      <button
                        type="button"
                        disabled={isSelf || lastAdmin}
                        onClick={() => removeUser(user)}
                        className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs text-[#c62828] hover:bg-[#fdeceb] disabled:opacity-40"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {passwordUser
        ? createPortal(
            <div
              className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
            >
              <div
                className="absolute inset-0 bg-black/45"
                onClick={() => setPasswordUser(null)}
              />
              <form
                onSubmit={savePassword}
                className="relative w-full max-w-sm rounded-xl border border-[var(--border)] bg-white p-5 shadow-lg"
              >
                <div className="text-sm font-semibold">
                  Новый пароль для {passwordUser.login}
                </div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="field mt-3"
                  minLength={6}
                  required
                  autoFocus
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPasswordUser(null)}
                    className="rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-[var(--brand)] px-3.5 py-2 text-sm font-medium text-[#1a1a1a] disabled:opacity-60"
                  >
                    {saving ? "Сохранение…" : "Сохранить"}
                  </button>
                </div>
              </form>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
