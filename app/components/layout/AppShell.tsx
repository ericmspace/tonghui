import { Link, NavLink } from "@remix-run/react";
import { cx } from "~/lib/cx";
import { MODULES } from "~/lib/utils";
import { RoleSwitcher } from "./RoleSwitcher";

/**
 * 全局应用框架：左侧固定导航 + 右侧内容区。
 * 沉浸式页面（如探索模式）可不使用本框架以获得全屏。
 */
export function AppShell({
  children,
  title,
  subtitle,
  actions,
  wide,
}: {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen flex">
      <SideNav />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar title={title} subtitle={subtitle} actions={actions} />
        <main className={cx("flex-1 px-6 lg:px-10 pb-12", wide ? "" : "max-w-[1400px] w-full mx-auto")}>
          {children}
        </main>
      </div>
    </div>
  );
}

function SideNav() {
  return (
    <aside className="hidden md:flex flex-col w-[248px] shrink-0 sticky top-0 h-screen p-4">
      <div className="glass rounded-4xl flex-1 flex flex-col p-4">
        <Link to="/" className="flex items-center gap-3 px-3 py-3 mb-2">
          <span className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-400 to-peach text-white text-xl shadow-glow">
            🖍️
          </span>
          <span className="leading-tight">
            <span className="block font-extrabold text-ink text-[17px]">童绘</span>
            <span className="block text-[11px] text-ink-muted tracking-wide">AI 绘本教育平台</span>
          </span>
        </Link>

        <nav className="flex-1 flex flex-col gap-1 mt-2">
          {MODULES.map((m) => (
            <NavLink
              key={m.id}
              to={m.href}
              className={({ isActive }) =>
                cx(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-200",
                  isActive ? "bg-white shadow-soft" : "hover:bg-white/60"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cx(
                      "grid place-items-center w-9 h-9 rounded-xl text-lg transition-transform group-hover:scale-110 bg-gradient-to-br text-white",
                      m.accent
                    )}
                  >
                    {m.icon}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cx(
                        "block text-[14px] font-bold truncate",
                        isActive ? "text-ink" : "text-ink-soft"
                      )}
                    >
                      {m.title}
                    </span>
                    <span className="block text-[11px] text-ink-faint truncate">{m.subtitle}</span>
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-3 pt-3 border-t border-black/[0.06] px-2">
          <p className="text-[11px] text-ink-faint mb-2 px-1">当前身份</p>
          <RoleSwitcher />
        </div>
      </div>
    </aside>
  );
}

function TopBar({
  title,
  subtitle,
  actions,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 px-6 lg:px-10 py-5">
      <div className="flex items-center justify-between gap-4 max-w-[1400px] mx-auto w-full">
        <div>
          {title && <h1 className="text-2xl lg:text-[28px] font-extrabold text-ink tracking-tight">{title}</h1>}
          {subtitle && <p className="text-sm text-ink-muted mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {actions}
          <div className="md:hidden">
            <RoleSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
