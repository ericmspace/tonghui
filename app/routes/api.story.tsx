import { json, type ActionFunctionArgs } from "@remix-run/node";
import { generateStory } from "~/services/story.server";
import { createRecord, saveAsset } from "~/services/db.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return json({ error: "Method Not Allowed" }, { status: 405 });
  const body = await request.json().catch(() => ({}));
  const { imageBase64 } = body ?? {};
  if (!imageBase64) return json({ error: "缺少 imageBase64" }, { status: 400 });

  const r = await generateStory({ imageBase64 });

  // 落库：保存承载图 + 故事，记录生成时间
  const assetId = saveAsset(imageBase64) ?? undefined;
  const rec = createRecord({
    type: "story",
    title: r.title,
    status: "done",
    mocked: r.mocked,
    imageAssetId: assetId,
    story: { title: r.title, description: r.description, story: r.story, character: r.character },
  });

  return json({ ...r, recordId: rec.id, createdAt: rec.createdAt });
}
