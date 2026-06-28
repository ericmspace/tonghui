import { json, type ActionFunctionArgs } from "@remix-run/node";
import { analyzeEmotion } from "~/services/emotion.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return json({ error: "Method Not Allowed" }, { status: 405 });
  const body = await request.json().catch(() => ({}));
  const { summary = "书写过程平稳，偶有停顿。" } = body ?? {};
  const r = await analyzeEmotion({ summary });
  return json(r);
}
