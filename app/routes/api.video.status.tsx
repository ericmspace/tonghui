import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { pollVideo } from "~/services/video.server";
import { findByTaskId, updateRecord, type CreationStatus } from "~/services/db.server";

const MAP: Record<string, CreationStatus> = {
  PENDING: "pending",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  UNKNOWN: "pending",
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId");
  if (!taskId) return json({ error: "缺少 taskId" }, { status: 400 });

  const r = await pollVideo(taskId);

  // 同步更新库中视频记录的状态/产出（支持回来续看）
  const rec = findByTaskId(taskId);
  if (rec) {
    updateRecord(rec.id, {
      status: MAP[r.status] ?? "pending",
      video: { taskId, videoUrl: r.videoUrl },
    });
  }

  return json(r);
}
