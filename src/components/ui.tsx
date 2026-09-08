import Link from "next/link";
import { redirect } from "next/navigation";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { HeaderAccount } from "@/components/HeaderAccount";
import { ReportsNav } from "@/components/ReportsNav";

export { PrimaryButton, SecondaryButton } from "@/components/ui-client";

const NAV_BEFORE = [
  { href: "/", label: "Обзор" },
  { href: "/shipments", label: "Поставки" },
  { href: "/stock", label: "Остатки" },
  { href: "/transfers", label: "Перемещение товаров" },
];

const NAV_AFTER = [{ href: "/settings", label: "Настройки" }];

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active?: string;
}) {
  const isActive =
    href === "/" ? active === "/" : Boolean(active?.startsWith(href));
  return (
    <Link
      href={href}
      className={`relative whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
        isActive
          ? "bg-[var(--surface)] font-medium text-[var(--text)]"
          : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
      }`}
    >
      {label}
    </Link>
  );
}

export async function AppHeader({
  active,
  wide,
}: {
  active?: string;
  wide?: boolean;
}) {
  const user = await getCurrentUser();
  if (!user) {
    await clearSessionCookie();
    redirect("/login");
  }

  return (
    <header className="border-b border-[var(--border)] bg-white">
      <div
        className={`mx-auto flex items-center gap-6 px-5 py-3 ${wide ? "max-w-[1920px]" : "max-w-[1400px]"}`}
      >
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand)] text-sm font-bold text-[#1a1a1a]">
            PL
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-[var(--text)]">
              Packing List
            </div>
            <div className="text-xs text-[var(--muted)]">Поставки из Китая</div>
          </div>
        </Link>

        <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {NAV_BEFORE.map((item) => (
            <NavLink key={item.href} {...item} active={active} />
          ))}
          <ReportsNav active={active} />
          {NAV_AFTER.map((item) => (
            <NavLink key={item.href} {...item} active={active} />
          ))}
          {user.role === "admin" ? (
            <NavLink href="/users" label="Пользователи" active={active} />
          ) : null}
        </nav>
        <HeaderAccount login={user.login} name={user.name} role={user.role} />
      </div>
    </header>
  );
}

export function PageShell({
  title,
  description,
  actions,
  wide,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`mx-auto px-5 py-5 ${wide ? "max-w-[1920px]" : "max-w-[1400px]"}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-white ${className}`}
    >
      {children}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "ok" | "warn" | "danger" | "info";
}) {
  const tones = {
    default: "bg-[var(--surface)] text-[var(--text)]",
    ok: "bg-[#e8f6ec] text-[#1a7f37]",
    warn: "bg-[#fff4e5] text-[#b35c00]",
    danger: "bg-[#fdeceb] text-[#c62828]",
    info: "bg-[#e8f1ff] text-[#1a5fb4]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="text-base font-medium text-[var(--text)]">{title}</div>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

