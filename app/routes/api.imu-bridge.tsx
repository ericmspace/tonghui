// 资源路由：按引导生命周期托管 Python IMU WebSocket 桥进程。
// 选「真实笔」点开始引导 → POST {action:"start"}（拉起桥）；结束/停止 → POST {action:"stop"}（关桥）。
// 浏览器不能直接开进程，由本机 Node 服务端代为 spawn。仅本地使用。
//
// 可配置环境变量：
//   IMU_BRIDGE_PYTHON       python 可执行文件路径
//   IMU_BRIDGE_SCRIPT       imu_ws_bridge.py 路径
//   IMU_BRIDGE_MODE         sim（默认）| serial
//   IMU_BRIDGE_SERIAL_PORT  serial 模式下的串口（如 COM3）

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import fs from "node:fs";

const PORT = 8765;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// 用 globalThis 存子进程引用，避免 Remix 开发期模块热重载丢失句柄
function holder(): { child: ChildProcess | null; mode?: string } {
  const g = globalThis as unknown as { __imuBridge?: { child: ChildProcess | null; mode?: string } };
  if (!g.__imuBridge) g.__imuBridge = { child: null };
  return g.__imuBridge;
}

function isPortUp(timeout = 600): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.connect({ port: PORT, host: "127.0.0.1" });
    let done = false;
    const finish = (v: boolean) => {
      if (!done) {
        done = true;
        s.destroy();
        resolve(v);
      }
    };
    s.setTimeout(timeout);
    s.on("connect", () => finish(true));
    s.on("timeout", () => finish(false));
    s.on("error", () => finish(false));
  });
}

function pythonBin(): string {
  const env = process.env.IMU_BRIDGE_PYTHON;
  if (env && fs.existsSync(env)) return env;
  const known = "C:\\Users\\75506\\AppData\\Local\\Programs\\Python\\Python312\\python.exe";
  if (fs.existsSync(known)) return known;
  return "python";
}

function scriptPath(): string {
  return (
    process.env.IMU_BRIDGE_SCRIPT ||
    path.resolve(process.cwd(), "..", "group16", "PenAssessment", "imu_ws_bridge.py")
  );
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return json({ ok: false, error: "Method Not Allowed" }, { status: 405 });
  const body = (await request.json().catch(() => ({}))) as { action?: string; mode?: string; port?: string };
  const h = holder();

  if (body.action === "stop") {
    if (h.child && !h.child.killed) {
      try {
        h.child.kill();
      } catch {
        /* ignore */
      }
      h.child = null;
      h.mode = undefined;
      return json({ ok: true, stopped: true });
    }
    return json({ ok: true, stopped: false }); // 没有我们拉起的进程（可能是外部手动起的，不动它）
  }

  // start —— 模式由前端意图决定（真实笔=serial），其次环境变量，再次默认 sim
  const mode = body.mode || process.env.IMU_BRIDGE_MODE || "sim";
  const serialPort = body.port || process.env.IMU_BRIDGE_SERIAL_PORT || "auto";

  if (h.child && !h.child.killed) {
    if (h.mode === mode) return json({ ok: true, already: true, mode }); // 同模式复用
    // 模式不同 → 关掉旧桥再起新的（如 sim→serial）
    try {
      h.child.kill();
    } catch {
      /* ignore */
    }
    h.child = null;
    h.mode = undefined;
    await sleep(400); // 等端口/串口释放
  } else if (await isPortUp()) {
    return json({ ok: true, external: true }); // 外部已起的桥，模式未知，直接复用
  }

  const script = scriptPath();
  if (!fs.existsSync(script)) return json({ ok: false, error: `找不到桥脚本：${script}` });

  const args = [script, "--mode", mode, "--host", "127.0.0.1", "--port", String(PORT)];
  if (mode === "serial") args.push("--serial-port", serialPort);

  try {
    const child = spawn(pythonBin(), args, {
      cwd: path.dirname(script),
      stdio: "ignore",
      windowsHide: true,
    });
    h.child = child;
    h.mode = mode;
    child.on("exit", () => {
      if (holder().child === child) {
        holder().child = null;
        holder().mode = undefined;
      }
    });
    child.on("error", () => {
      if (holder().child === child) {
        holder().child = null;
        holder().mode = undefined;
      }
    });
  } catch {
    return json({ ok: false, error: "无法启动桥进程" });
  }

  // 等端口就绪（最多约 6s）。serial 模式下端口起来即代表串口已成功打开。
  for (let i = 0; i < 24; i++) {
    if (await isPortUp()) return json({ ok: true, spawned: true, mode });
    await sleep(250);
  }
  return json({ ok: false, error: "桥已拉起但端口未就绪（serial：确认笔/串口已连接）" });
}
