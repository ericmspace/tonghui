import type { MetaFunction } from "@remix-run/node";
import { AppShell } from "~/components/layout/AppShell";
import { Badge, Button, Panel } from "~/components/ui/primitives";

export const meta: MetaFunction = () => [{ title: "可编辑场景 · 童绘" }];

export default function UnityPage() {
  return (
    <AppShell
      title="可编辑场景"
      subtitle="面向沉浸式互动的可视化编辑骨架（结构留白，待接入 Unity WebGL）"
      actions={<Badge tone="lavender">结构占位 · WIP</Badge>}
    >
      <div className="grid lg:grid-cols-[260px_1fr_260px] gap-6 items-start">
        {/* 左：层级面板骨架 */}
        <Panel title="场景层级" subtitle="Hierarchy">
          <ul className="space-y-1.5 text-sm">
            {["🌍 场景根", "  🎬 摄像机", "  💡 主光源", "  🧒 角色 · 小主人", "  🌳 大树朋友", "  🏠 暖色小屋"].map(
              (n, i) => (
                <li
                  key={i}
                  className="px-3 py-2 rounded-xl hover:bg-white/70 text-ink-soft cursor-default whitespace-pre"
                >
                  {n}
                </li>
              )
            )}
          </ul>
        </Panel>

        {/* 中：视口留白 */}
        <Panel title="场景视口" subtitle="Unity WebGL 挂载点（留白）">
          {/*
            TODO: 后续将 Unity 导出的 WebGL Build 通过 <iframe> 或 UnityLoader 挂载到此处。
            预留容器 id="unity-viewport"，保持 16:9。
          */}
          <div
            id="unity-viewport"
            className="relative aspect-video rounded-4xl hairline overflow-hidden bg-[radial-gradient(circle_at_50%_40%,#ffffff,#eef1f7)] grid place-items-center"
          >
            <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#000_1px,transparent_1px),linear-gradient(90deg,#000_1px,transparent_1px)] [background-size:32px_32px]" />
            <div className="relative text-center">
              <div className="text-6xl mb-3 animate-float">🧩</div>
              <p className="text-ink-soft font-semibold">Unity 场景视口</p>
              <p className="text-xs text-ink-faint mt-1">此区域预留给 Unity WebGL 构建产物</p>
              <Button variant="outline" className="mt-4" disabled>
                ▶ 加载场景（待接入）
              </Button>
            </div>
          </div>

          {/* 工具条骨架 */}
          <div className="mt-4 flex flex-wrap gap-2">
            {["✋ 移动", "🔄 旋转", "⤢ 缩放", "🎯 对齐", "📷 取景"].map((t) => (
              <span
                key={t}
                className="px-3 py-1.5 rounded-full bg-black/[0.04] text-ink-muted text-sm cursor-default"
              >
                {t}
              </span>
            ))}
          </div>
        </Panel>

        {/* 右：属性面板骨架 */}
        <Panel title="属性" subtitle="Inspector">
          <div className="space-y-4 text-sm">
            {[
              { label: "位置 Position", fields: ["X", "Y", "Z"] },
              { label: "旋转 Rotation", fields: ["X", "Y", "Z"] },
              { label: "缩放 Scale", fields: ["X", "Y", "Z"] },
            ].map((g) => (
              <div key={g.label}>
                <p className="text-xs text-ink-muted mb-1.5">{g.label}</p>
                <div className="grid grid-cols-3 gap-2">
                  {g.fields.map((f) => (
                    <div key={f} className="rounded-xl hairline bg-white/60 px-2 py-2 text-center text-ink-faint">
                      {f} 0.0
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-black/[0.06] text-xs text-ink-faint">
              说明：本页仅搭建编辑器结构，真正的可编辑逻辑与 Unity 运行时将于后续版本接入。
            </div>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
