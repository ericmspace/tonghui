import { cx } from "~/lib/cx";

/* ============================ Button ============================ */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "soft" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none select-none";
  const sizes = {
    sm: "text-sm px-4 h-9",
    md: "text-[15px] px-5 h-11",
    lg: "text-base px-7 h-13 h-[52px]",
  };
  const variants = {
    primary: "bg-brand-500 text-white shadow-glow hover:bg-brand-600 hover:-translate-y-0.5",
    soft: "bg-brand-100 text-brand-600 hover:bg-brand-200",
    ghost: "text-ink-soft hover:bg-black/[0.05]",
    outline: "hairline bg-white/70 text-ink-soft hover:bg-white",
  };
  return (
    <button
      className={cx(base, sizes[size], variants[variant], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="w-4 h-4" />}
      {children}
    </button>
  );
}

/* ============================ Card / Panel ============================ */
export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("glass rounded-4xl p-6", className)} {...rest}>
      {children}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  right,
  className,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cx("glass-strong rounded-4xl p-6", className)}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-4 mb-5">
          <div>
            {title && <h2 className="text-lg font-bold text-ink">{title}</h2>}
            {subtitle && <p className="text-sm text-ink-muted mt-0.5">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

/* ============================ Badge ============================ */
export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brand" | "mint" | "sky" | "lavender" | "warn";
  className?: string;
}) {
  const tones = {
    neutral: "bg-black/[0.05] text-ink-muted",
    brand: "bg-brand-100 text-brand-600",
    mint: "bg-mint/15 text-emerald-700",
    sky: "bg-sky/15 text-blue-700",
    lavender: "bg-lavender/15 text-violet-700",
    warn: "bg-sunny/25 text-amber-700",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ============================ Spinner ============================ */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("animate-spin", className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/* ============================ Toggle ============================ */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative w-12 h-7 rounded-full transition-colors duration-300",
          checked ? "bg-brand-500" : "bg-black/15"
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-300",
            checked && "translate-x-5"
          )}
        />
      </button>
      {label && <span className="text-sm font-medium text-ink-soft">{label}</span>}
    </label>
  );
}

/* ============================ Segmented ============================ */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cx("inline-flex p-1 rounded-full bg-black/[0.05]", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "px-4 h-9 rounded-full text-sm font-semibold transition-all duration-200",
            value === o.value ? "bg-white text-ink shadow-soft" : "text-ink-muted hover:text-ink-soft"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
