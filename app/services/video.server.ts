/**
 * 图生视频：happyhorse-1.1-i2v，异步任务模式（原生 DashScope 接口）。
 * 提交（X-DashScope-Async: enable）→ 返回 task_id → 轮询任务状态拿视频 URL。
 *
 * 真实调用形态严格对齐官方 curl：
 *   POST {DASHSCOPE_BASE}/api/v1/services/aigc/video-generation/video-synthesis
 *   headers: X-DashScope-Async: enable, Authorization: Bearer <KEY>
 *   body: { model, input:{ prompt, media:[{type:"first_frame", url}] }, parameters:{resolution,duration} }
 *
 * 注意：first_frame 必须是「公网可访问的图片 URL」。画板/拍照产物是 dataURL，
 * 需先上传到图床换公网 URL —— 该环节（图床）按当前需求【留白未实现】，见
 * uploadFirstFrameToPublicUrl()。无公网 URL 时回退 Mock 占位视频。
 *
 * 实测：截至接入时，本 KEY 调用 happyhorse 仍返回 Model.AccessDenied，
 * 待业务空间授权对该 API Key 生效后即可直接真实出片，无需改代码。
 */
import { canCallReal, config, dsFetch, logFallback } from "./dashscope.server";
import { mockVideo } from "./mock.server";

export type VideoSubmit = { taskId: string; mocked: boolean };
export type VideoStatus = {
  taskId: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "UNKNOWN";
  videoUrl?: string;
  mocked: boolean;
  message?: string;
};

/* ------------------------------------------------------------------ *
 * 【留白 · 待实现】首帧图床上传
 * ------------------------------------------------------------------ *
 * happyhorse 的 first_frame 需要公网可访问 URL。此处预留把本地
 * dataURL/base64 上传到对象存储（OSS/COS/S3…）并返回公网 URL 的能力。
 *
 * 后续实现示例：
 *   const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
 *   const { url } = await ossClient.put(`frames/${id}.png`, buf);
 *   return url;
 *
 * 当前需求：先不实现，返回 null（无公网 URL → 上层回退 Mock）。
 */
async function uploadFirstFrameToPublicUrl(_imageDataUrl: string): Promise<string | null> {
  // TODO(图床): 接入对象存储后在此返回公网图片 URL。
  return null;
}

export async function submitVideo(params: {
  imageUrl: string;
  prompt: string;
}): Promise<VideoSubmit> {
  const { imageUrl, prompt } = params;

  // 解析首帧公网 URL：已是 http(s) 直接用；否则尝试图床（当前留白 → null）。
  let publicUrl: string | null = /^https?:\/\//.test(imageUrl) ? imageUrl : null;
  if (!publicUrl && imageUrl.startsWith("data:")) {
    publicUrl = await uploadFirstFrameToPublicUrl(imageUrl);
  }

  if (!canCallReal() || !publicUrl) {
    return { taskId: mockVideo().taskId, mocked: true };
  }

  try {
    const json = await dsFetch<any>(
      `${config.base}/api/v1/services/aigc/video-generation/video-synthesis`,
      {
        method: "POST",
        async: true,
        timeoutMs: 30_000,
        body: {
          model: config.models.video,
          input: {
            prompt: prompt || "让画面里的角色自然地动起来，温柔、缓慢、适合儿童观看。",
            media: [{ type: "first_frame", url: publicUrl }],
          },
          parameters: { resolution: "720P", duration: 5 },
        },
      }
    );
    const taskId = json?.output?.task_id ?? json?.task_id;
    if (!taskId) throw new Error("提交未返回 task_id");
    return { taskId, mocked: false };
  } catch (e) {
    logFallback("video:submit", e);
    return { taskId: mockVideo().taskId, mocked: true };
  }
}

export async function pollVideo(taskId: string): Promise<VideoStatus> {
  if (taskId.startsWith("mock") || !canCallReal()) {
    const m = mockVideo();
    return { taskId, status: "SUCCEEDED", videoUrl: m.videoUrl, mocked: true };
  }
  try {
    const json = await dsFetch<any>(`${config.base}/api/v1/tasks/${taskId}`, {
      method: "GET",
      timeoutMs: 20_000,
    });
    const out = json?.output ?? {};
    const status = (out.task_status ?? "UNKNOWN") as VideoStatus["status"];
    const videoUrl = out.video_url ?? out.results?.video_url ?? out.results?.[0]?.url;
    return { taskId, status, videoUrl, mocked: false };
  } catch (e) {
    logFallback("video:poll", e);
    const m = mockVideo();
    return { taskId, status: "SUCCEEDED", videoUrl: m.videoUrl, mocked: true };
  }
}
