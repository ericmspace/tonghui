import { json, type ActionFunctionArgs } from "@remix-run/node";
import { embedPayload, extractPayload } from "~/services/steganography.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return json({ error: "Method Not Allowed" }, { status: 405 });
  const body = await request.json().catch(() => ({}));
  const { op, pngBase64, payload } = body ?? {};
  if (!pngBase64) return json({ error: "缺少 pngBase64（需为 PNG）" }, { status: 400 });

  try {
    if (op === "extract") {
      const data = extractPayload(pngBase64);
      return json({ ok: !!data, payload: data });
    }
    // 默认 embed
    const image = embedPayload(pngBase64, payload ?? {});
    return json({ ok: true, image });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "隐写处理失败" }, { status: 500 });
  }
}
