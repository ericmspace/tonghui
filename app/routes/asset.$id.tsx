import type { LoaderFunctionArgs } from "@remix-run/node";
import { getAsset } from "~/services/db.server";

/** 资源服务：按 assetId 返回二进制图片（强缓存，内容不可变） */
export async function loader({ params }: LoaderFunctionArgs) {
  const id = params.id!;
  const a = getAsset(id);
  if (!a) throw new Response("资源不存在", { status: 404 });
  return new Response(new Uint8Array(a.buf), {
    headers: {
      "Content-Type": a.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
