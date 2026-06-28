import { json, type ActionFunctionArgs } from "@remix-run/node";
import { submitVideo } from "~/services/video.server";
import { createRecord, saveAsset } from "~/services/db.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return json({ error: "Method Not Allowed" }, { status: 405 });
  const body = await request.json().catch(() => ({}));
  const { imageUrl, prompt = "" } = body ?? {};
  if (!imageUrl) return json({ error: "缺少 imageUrl（需公网可访问的首帧图）" }, { status: 400 });

  const r = await submitVideo({ imageUrl, prompt });

  // 落库：视频是长耗时任务，记录 taskId 与首帧图，便于离开后回来续看
  const assetId = saveAsset(imageUrl) ?? undefined;
  const rec = createRecord({
    type: "video",
    title: "绘本动画",
    status: r.mocked ? "succeeded" : "pending",
    mocked: r.mocked,
    imageAssetId: assetId,
    video: { taskId: r.taskId },
    meta: { prompt },
  });

  return json({ ...r, recordId: rec.id, createdAt: rec.createdAt });
}
