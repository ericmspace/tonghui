import { Link } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";
import { AppShell } from "~/components/layout/AppShell";
import { Badge } from "~/components/ui/primitives";
import { MODULES } from "~/lib/utils";
import { cx } from "~/lib/cx";

export const meta: MetaFunction = () => [
  { title: "童绘 · AI 绘本教育平台" },
  { name: "description", content: "面向 ADHD / 自闭症等特殊儿童的 AI 绘本教育新范式" },
];

export default function Index() {
  return (
    <AppShell>
      {/* Hero */}
      <section className="relative mt-2 mb-10 animate-fade-up">
        <div className="glass-strong rounded-5xl p-8 lg:p-12 overflow-hidden relative">
          <div className="absolute -right-10 -top-10 w-64 h-64 rounded-full bg-brand-200/40 blur-3xl" />
          <div className="absolute right-32 bottom-0 w-48 h-48 rounded-full bg-sky/20 blur-3xl" />
          <div className="relative">
            <Badge tone="brand" className="mb-4">
              ✨ AI 绘本教育新范式
            </Badge>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-ink tracking-tight leading-tight">
              让每个孩子，
              <br className="hidden sm:block" />
              都画出自己的<span className="text-brand-500">小世界</span>
            </h1>
            <p className="mt-5 text-ink-muted max-w-xl leading-relaxed">
              一支带摄像头的笔，连接拍照、简笔绘本、自由涂色、生视频探索、看图讲故事，
              到 IEP 数据分析的完整链路。专为 ADHD / 自闭症等特殊儿童的学习节奏而设计。
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/capture"
                className="inline-flex items-center gap-2 rounded-full bg-brand-500 text-white px-7 h-13 h-[52px] font-semibold shadow-glow hover:bg-brand-600 hover:-translate-y-0.5 transition-all"
              >
                📸 开始拍照绘本
              </Link>
              <Link
                to="/iep"
                className="inline-flex items-center gap-2 rounded-full hairline bg-white/70 text-ink-soft px-7 h-[52px] font-semibold hover:bg-white transition"
              >
                📊 查看 IEP 分析
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 模块卡片 */}
      <section>
        <div className="flex items-end justify-between mb-5">
          <h2 className="text-xl font-bold text-ink">功能模块</h2>
          <span className="text-sm text-ink-faint">点击任意卡片进入</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {MODULES.map((m, i) => (
            <Link
              key={m.id}
              to={m.href}
              className="group glass rounded-4xl p-6 hover:shadow-lift hover:-translate-y-1 transition-all duration-300 animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between">
                <span
                  className={cx(
                    "grid place-items-center w-14 h-14 rounded-3xl text-2xl bg-gradient-to-br text-white shadow-soft group-hover:scale-110 transition-transform",
                    m.accent
                  )}
                >
                  {m.icon}
                </span>
                <span className="text-3xl font-black text-black/[0.06] group-hover:text-brand-200 transition-colors">
                  {m.no}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-bold text-ink">{m.title}</h3>
              <p className="text-xs text-brand-500 font-semibold mt-0.5">{m.subtitle}</p>
              <p className="mt-2 text-sm text-ink-muted leading-relaxed">{m.desc}</p>
              <span className="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-ink-soft group-hover:text-brand-500 transition-colors">
                进入 <span className="group-hover:translate-x-1 transition-transform">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="mt-12 text-center text-xs text-ink-faint">
        童绘 Tonghui · 为特殊儿童而生的 AI 绘本教育平台 · Demo
      </footer>
    </AppShell>
  );
}
