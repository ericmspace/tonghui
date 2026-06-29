// 资源路由：AI 判形状。前端把摄像头帧 + 目标传来，交给视觉模型判断是否画到。
import { json, type ActionFunctionArgs } from "@remix-run/node";
import { checkShape } from "~/services/shape.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return json({ error: "Method Not Allowed" }, { status: 405 });
  const body = await request.json().catch(() => null);
  if (!body?.imageBase64 || !body?.target) {
    return json({ error: "缺少 imageBase64 或 target" }, { status: 400 });
  }
  const r = await checkShape({ imageBase64: body.imageBase64, target: body.target });
  return json(r);
}
