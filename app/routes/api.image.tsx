import { json, type ActionFunctionArgs } from "@remix-run/node";
import { generateColoringImage, generateDirectionalImage } from "~/services/image.server";
import { createRecord, saveAsset } from "~/services/db.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return json({ error: "Method Not Allowed" }, { status: 405 });
  const body = await request.json().catch(() => ({}));
  const { imageBase64, colored = false, mode = "coloring", direction, step = 1, extraPrompt } = body ?? {};
  if (!imageBase64) return json({ error: "缺少 imageBase64" }, { status: 400 });

  // 探索模式的方向延展图属于漫游过程，不落库
  if (mode === "direction" && direction) {
    const r = await generateDirectionalImage({ imageBase64, direction, step: Number(step) || 1 });
    return json(r);
  }

  const r = await generateColoringImage({ imageBase64, colored: !!colored, extraPrompt });

  // 落库：拍照绘本是一次「生成经历」
  const assetId = saveAsset(r.image) ?? undefined;
  const rec = createRecord({
    type: "image",
    title: colored ? "上色绘本" : "简笔绘本",
    status: "done",
    mocked: r.mocked,
    imageAssetId: assetId,
    meta: { colored: !!colored },
  });

  return json({ ...r, recordId: rec.id, createdAt: rec.createdAt });
}
