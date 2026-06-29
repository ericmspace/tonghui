// 资源路由：把一次语音引导会话的 IMU 指标转发到教师端 imu_platform。
// 服务端转发（而非浏览器直连）以避免跨域，并把教师端地址收在后端。
// 教师端地址：环境变量 IMU_PLATFORM_URL，默认 http://localhost:3100。

import { json, type ActionFunctionArgs } from "@remix-run/node";

const PLATFORM = (process.env.IMU_PLATFORM_URL || "http://localhost:3100").replace(/\/$/, "");

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return json({ ok: false, error: "Method Not Allowed" }, { status: 405 });

  const body = await request.json().catch(() => null);
  if (!body || !body.childId || !body.features) {
    return json({ ok: false, error: "缺少 childId 或 features" }, { status: 400 });
  }

  try {
    const res = await fetch(`${PLATFORM}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // 教师端可能未启动，给个短超时避免页面卡住
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json({ ok: false, error: data?.error || `教师端拒绝（${res.status}）` });
    }
    return json({ ok: true, id: data.id, childId: data.childId, createdAt: data.createdAt });
  } catch (e) {
    const msg = e instanceof Error && e.name === "TimeoutError" ? "教师端无响应（超时）" : "教师端未连接";
    return json({ ok: false, error: msg });
  }
}
