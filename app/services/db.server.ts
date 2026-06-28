/**
 * 轻量持久化数据层（JSON 文件 + 二进制资源）。
 * 记录所有「生成经历」：拍照绘本(image) / 看图故事(story) / 图生视频(video)。
 * 视频为长耗时异步任务，状态可被多次更新，用户离开后回来仍可续看。
 *
 * 设计取舍：为避免 Windows 原生模块编译，采用 JSON 文件存储；
 * 写入用 tmp + rename 原子替换，规避半写损坏。资源(图片)以二进制单独落盘，
 * 通过 /asset/:id 资源路由按需读取，避免把 1MB+ base64 塞进 JSON。
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const ASSET_DIR = path.join(DATA_DIR, "assets");
const DB_FILE = path.join(DATA_DIR, "records.json");
const ASSET_INDEX = path.join(DATA_DIR, "assets.json");

fs.mkdirSync(ASSET_DIR, { recursive: true });

export type CreationType = "image" | "story" | "video";
export type CreationStatus = "done" | "pending" | "running" | "succeeded" | "failed";

export interface CharacterCard {
  name: string;
  description: string;
  personality?: string;
  scenario?: string;
  tags?: string[];
}

export interface CreationRecord {
  id: string;
  type: CreationType;
  title: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  status: CreationStatus;
  mocked?: boolean;
  imageAssetId?: string; // 产出/承载图（用于回溯与缩略）
  // story
  story?: { title: string; description: string; story: string; character: CharacterCard };
  // video
  video?: { taskId: string; videoUrl?: string };
  meta?: Record<string, unknown>;
}

/* ---------------- 内存态 + 持久化 ---------------- */
type AssetIndex = Record<string, string>; // assetId -> mime

function loadJson<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch (e) {
    console.warn(`[db] 读取 ${path.basename(file)} 失败，使用空集`, e);
  }
  return fallback;
}

let records: CreationRecord[] = loadJson<CreationRecord[]>(DB_FILE, []);
let assetIndex: AssetIndex = loadJson<AssetIndex>(ASSET_INDEX, {});

function atomicWrite(file: string, data: string) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}
function persistRecords() {
  atomicWrite(DB_FILE, JSON.stringify(records, null, 2));
}
function persistAssets() {
  atomicWrite(ASSET_INDEX, JSON.stringify(assetIndex, null, 2));
}

/* ---------------- 资源（图片）存取 ---------------- */
/** 保存 dataURL 为二进制资源，返回 assetId；非 dataURL（如远程视频 URL）返回 null */
export function saveAsset(dataUrl: string): string | null {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const mime = m[1];
  const buf = Buffer.from(m[2], "base64");
  const id = randomUUID();
  fs.writeFileSync(path.join(ASSET_DIR, id), buf);
  assetIndex[id] = mime;
  persistAssets();
  return id;
}

export function getAsset(id: string): { buf: Buffer; mime: string } | null {
  const mime = assetIndex[id];
  const file = path.join(ASSET_DIR, id);
  if (!mime || !fs.existsSync(file)) return null;
  return { buf: fs.readFileSync(file), mime };
}

export function assetUrl(id?: string): string | undefined {
  return id ? `/asset/${id}` : undefined;
}

/** 读取资源并转回 dataURL（隐写/二次处理用） */
export function assetDataUrl(id?: string): string | null {
  if (!id) return null;
  const a = getAsset(id);
  return a ? `data:${a.mime};base64,${a.buf.toString("base64")}` : null;
}

/* ---------------- 记录 CRUD ---------------- */
export function createRecord(
  input: Omit<CreationRecord, "id" | "createdAt" | "updatedAt">
): CreationRecord {
  const now = new Date().toISOString();
  const rec: CreationRecord = { id: randomUUID(), createdAt: now, updatedAt: now, ...input };
  records.unshift(rec);
  persistRecords();
  return rec;
}

export function updateRecord(id: string, patch: Partial<CreationRecord>): CreationRecord | null {
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  records[idx] = { ...records[idx], ...patch, updatedAt: new Date().toISOString() };
  persistRecords();
  return records[idx];
}

export function getRecord(id: string): CreationRecord | null {
  return records.find((r) => r.id === id) ?? null;
}

export function findByTaskId(taskId: string): CreationRecord | null {
  return records.find((r) => r.video?.taskId === taskId) ?? null;
}

export function listRecords(type?: CreationType): CreationRecord[] {
  const all = type ? records.filter((r) => r.type === type) : records;
  // 已按 unshift 保证新→旧
  return all.slice(0, 200);
}
