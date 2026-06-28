import { json, type ActionFunctionArgs } from "@remix-run/node";
import { synthesizeSpeech } from "~/services/tts.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return json({ error: "Method Not Allowed" }, { status: 405 });
  const body = await request.json().catch(() => ({}));
  const { text } = body ?? {};
  if (!text) return json({ error: "缺少 text" }, { status: 400 });
  const r = await synthesizeSpeech({ text });
  return json(r);
}
