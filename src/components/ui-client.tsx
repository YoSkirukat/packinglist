export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:brightness-95 disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium hover:bg-[var(--surface)] disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}
