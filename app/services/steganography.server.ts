/**
 * PNG 隐写：将故事 + 角色信息写入/读取 PNG 的 tEXt 数据块。
 * 移植自用户提供的 Python 实现（read_png_chunks / decode_text_chunk / extract_character_data），
 * 并适配本项目：keyword 使用 "story"（绘本故事整包）与 "chara"（角色卡，兼容旧生态）。
 */

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/* ---------- CRC32 ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

type Chunk = { type: string; data: Buffer };

function readChunks(png: Buffer): Chunk[] {
  if (!png.subarray(0, 8).equals(PNG_SIG)) throw new Error("不是有效的 PNG 文件");
  const chunks: Chunk[] = [];
  let off = 8;
  while (off + 8 <= png.length) {
    const length = png.readUInt32BE(off);
    const type = png.toString("ascii", off + 4, off + 8);
    const data = png.subarray(off + 8, off + 8 + length);
    chunks.push({ type, data });
    off += 8 + length + 4; // length + type + data + crc
    if (type === "IEND") break;
  }
  return chunks;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** 构造 tEXt chunk：keyword \0 text（latin-1） */
function makeTextChunk(keyword: string, text: string): Buffer {
  const data = Buffer.concat([
    Buffer.from(keyword, "latin1"),
    Buffer.from([0]),
    Buffer.from(text, "latin1"),
  ]);
  return makeChunk("tEXt", data);
}

function decodeTextChunk(data: Buffer): { keyword: string; text: string } {
  const sep = data.indexOf(0);
  if (sep === -1) return { keyword: "", text: "" };
  return {
    keyword: data.subarray(0, sep).toString("latin1"),
    text: data.subarray(sep + 1).toString("latin1"),
  };
}

function toPngBuffer(input: string): Buffer {
  const b64 = input.startsWith("data:") ? input.slice(input.indexOf(",") + 1) : input;
  return Buffer.from(b64, "base64");
}

/**
 * 把任意 JSON 负载写入 PNG。文本以 base64(UTF-8 JSON) 存放，避免多字节字符破坏 latin-1。
 * 默认写入两个 keyword：story（本项目）与 chara（兼容角色卡生态）。
 */
export function embedPayload(pngBase64: string, payload: unknown): string {
  const png = toPngBuffer(pngBase64);
  const chunks = readChunks(png);
  const b64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");

  // 重建：在 IEND 之前插入 tEXt（剔除同名旧块）
  const out: Buffer[] = [PNG_SIG];
  for (const c of chunks) {
    if (c.type === "tEXt") {
      const { keyword } = decodeTextChunk(c.data);
      if (keyword === "story" || keyword === "chara") continue; // 覆盖旧值
    }
    if (c.type === "IEND") {
      out.push(makeTextChunk("story", b64));
      out.push(makeTextChunk("chara", b64));
    }
    out.push(makeChunk(c.type, c.data));
  }
  const result = Buffer.concat(out);
  return `data:image/png;base64,${result.toString("base64")}`;
}

/** 从 PNG 提取隐写负载（优先 story，其次 chara）。失败返回 null。 */
export function extractPayload(pngBase64: string): any | null {
  try {
    const png = toPngBuffer(pngBase64);
    const chunks = readChunks(png);
    const texts = chunks.filter((c) => c.type === "tEXt").map((c) => decodeTextChunk(c.data));
    const hit =
      texts.find((t) => t.keyword.toLowerCase() === "story") ??
      texts.find((t) => ["chara", "ccv3"].includes(t.keyword.toLowerCase()));
    if (!hit) return null;
    const raw = Buffer.from(hit.text, "base64").toString("utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
