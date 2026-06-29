import { json, type ActionFunctionArgs } from "@remix-run/node";
import { generateSentence } from "~/services/sentence.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return json({ error: "Method Not Allowed" }, { status: 405 });
  const body = await request.json().catch(() => ({}));
  const { imageBase64 } = body ?? {};
  if (!imageBase64) return json({ error: "缺少 imageBase64" }, { status: 400 });

  const r = await generateSentence({ imageBase64 });
  return json(r);
}
