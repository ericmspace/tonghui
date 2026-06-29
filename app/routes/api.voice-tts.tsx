/**
 * 语音引导 TTS 资源路由（火山/豆包语音）。
 * 前端 voiceGuide/tts.ts 的 speak() 调用本路由拿音频；
 * 未配火山凭证或合成失败时返回 204，前端回退浏览器朗读。
 */
import { json, type ActionFunctionArgs } from "@remix-run/node";
import { volcSynthesize } from "~/services/volcTts.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const { text } = (await request.json().catch(() => ({}))) as { text?: string };
  if (!text || !text.trim()) return new Response(null, { status: 204 });

  const audio = await volcSynthesize(text);
  if (!audio) return new Response(null, { status: 204 }); // 无凭证/失败 → 前端回退浏览器

  return json({ audioUrl: `data:${audio.mime};base64,${audio.base64}` });
}
