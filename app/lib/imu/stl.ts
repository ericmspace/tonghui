// STL 网格加载：解析二进制/ASCII STL，归一化为「长轴沿 +Y、居中、定长」的笔模型，
// 供笔姿态视图用与程序化圆柱相同的软件渲染管线绘制。STL 无颜色/单位信息，这里统一处理。

export type V3 = [number, number, number];
export interface Tri {
  a: V3;
  b: V3;
  c: V3;
  normal: V3; // 由顶点重算，单位向量
  centroid: V3;
}
export interface PenMesh {
  tris: Tri[];
  bottomY: number; // 归一化后最低点（笔尖端，用于地面/落点参考）
  topY: number; // 最高点
}

export type AxisName = "x" | "y" | "z" | "auto";
export interface PenOrient {
  /** 模型里「笔身/书写轴」是哪个轴；auto=取包围盒最长轴（侧边保护套可能更宽时需手动指定） */
  writingAxis?: AxisName;
  /** 笔尖是否朝下(-Y)：默认 true。自动判定哪一端是笔尖（横截面更细的一端），再放到该方向 */
  tipDown?: boolean;
  /** 强制是否绕 X 翻 180°（覆盖自动判定）。当两端横截面接近、自动判不准时显式指定 */
  flip?: boolean;
}

const TARGET_LEN = 2.0; // 归一化后笔长（与程序化圆柱量级一致）
const MAX_TRIS = 14000; // 逐像素 Z-buffer 软件渲染上限，超出按步长抽稀（真实笔约 9.7k 面，无需抽稀）

function sub(p: V3, q: V3): V3 {
  return [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
}
function cross(u: V3, v: V3): V3 {
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
}
function normalize(v: V3): V3 {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
}

/** 把原始三角形（任意单位/朝向）归一化为笔模型 */
function buildMesh(raw: [V3, V3, V3][], opts: PenOrient = {}): PenMesh {
  if (raw.length === 0) return { tris: [], bottomY: 0, topY: 0 };

  // 1) 包围盒 → 选书写轴（默认最长轴；保护套较宽时可显式指定 writingAxis）
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const t of raw)
    for (const p of t)
      for (let i = 0; i < 3; i++) {
        if (p[i] < min[i]) min[i] = p[i];
        if (p[i] > max[i]) max[i] = p[i];
      }
  const size: V3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const autoLongest = size[0] >= size[1] && size[0] >= size[2] ? 0 : size[1] >= size[2] ? 1 : 2;
  const axisIdx =
    opts.writingAxis && opts.writingAxis !== "auto" ? { x: 0, y: 1, z: 2 }[opts.writingAxis] : autoLongest;

  // 2) 把书写轴旋到 +Y（保持右手系）
  const toY = (p: V3): V3 => {
    if (axisIdx === 0) return [-p[1], p[0], p[2]]; // 绕 Z +90°：X→Y
    if (axisIdx === 2) return [p[0], p[2], -p[1]]; // 绕 X -90°：Z→Y
    return [p[0], p[1], p[2]];
  };

  // 3) 旋转后重算包围盒 → 居中 + 等比缩放到目标长度
  const min2: V3 = [Infinity, Infinity, Infinity];
  const max2: V3 = [-Infinity, -Infinity, -Infinity];
  const rotated = raw.map((t) => t.map(toY) as [V3, V3, V3]);
  for (const t of rotated)
    for (const p of t)
      for (let i = 0; i < 3; i++) {
        if (p[i] < min2[i]) min2[i] = p[i];
        if (p[i] > max2[i]) max2[i] = p[i];
      }
  const center: V3 = [(min2[0] + max2[0]) / 2, (min2[1] + max2[1]) / 2, (min2[2] + max2[2]) / 2];
  const lenY = max2[1] - min2[1] || 1;
  const scale = TARGET_LEN / lenY;

  // 3b) 判定笔尖端：横截面更细的一端即笔尖（用末端 20% 带内的「最大径向范围」，
  //     不受内部/中心顶点稀释；两侧保护套在中段不落入端带）。默认让笔尖朝下(-Y)。
  let topMax = 0, botMax = 0;
  for (const t of rotated)
    for (const p of t) {
      const r = Math.hypot(p[0] - center[0], p[2] - center[2]);
      if (p[1] <= min2[1] + 0.2 * lenY) botMax = Math.max(botMax, r);
      else if (p[1] >= max2[1] - 0.2 * lenY) topMax = Math.max(topMax, r);
    }
  // 近似对称（两端粗细接近）时不翻转，避免乱定向；显著更细的一端才认定为笔尖
  const ambiguous = Math.abs(botMax - topMax) < 0.12 * Math.max(botMax, topMax, 1e-6);
  const tipAtBottom = botMax <= topMax;
  const wantTipDown = opts.tipDown !== false; // 默认笔尖朝下
  // 显式 flip 覆盖自动判定；否则歧义时不翻、能判时把笔尖摆到期望方向。绕 X 翻 180°：(x,y,z)→(x,-y,-z)
  const flip = opts.flip !== undefined ? opts.flip : ambiguous ? false : wantTipDown ? !tipAtBottom : tipAtBottom;

  const xf = (p: V3): V3 => {
    const x = (p[0] - center[0]) * scale;
    const y = (p[1] - center[1]) * scale;
    const z = (p[2] - center[2]) * scale;
    return flip ? [x, -y, -z] : [x, y, z];
  };

  // 4) 按步长抽稀，组装三角形（重算法线 + 质心）
  const stride = Math.max(1, Math.ceil(rotated.length / MAX_TRIS));
  const tris: Tri[] = [];
  let bottomY = Infinity;
  let topY = -Infinity;
  for (let i = 0; i < rotated.length; i += stride) {
    const a = xf(rotated[i][0]);
    const b = xf(rotated[i][1]);
    const c = xf(rotated[i][2]);
    const normal = normalize(cross(sub(b, a), sub(c, a)));
    const centroid: V3 = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    tris.push({ a, b, c, normal, centroid });
    for (const p of [a, b, c]) {
      if (p[1] < bottomY) bottomY = p[1];
      if (p[1] > topY) topY = p[1];
    }
  }
  return { tris, bottomY, topY };
}

function parseBinary(buf: ArrayBuffer): [V3, V3, V3][] {
  const dv = new DataView(buf);
  const count = dv.getUint32(80, true);
  const raw: [V3, V3, V3][] = [];
  let off = 84;
  for (let i = 0; i < count && off + 48 <= buf.byteLength; i++, off += 50) {
    const v = (o: number): V3 => [dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true)];
    raw.push([v(off + 12), v(off + 24), v(off + 36)]);
  }
  return raw;
}

function parseAscii(text: string): [V3, V3, V3][] {
  const raw: [V3, V3, V3][] = [];
  const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  const verts: V3[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    verts.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
    if (verts.length === 3) {
      raw.push([verts[0], verts[1], verts[2]]);
      verts.length = 0;
    }
  }
  return raw;
}

/** 判二进制（按 84 + 50*count 体积）还是 ASCII，解析并归一化 */
export function parseStl(buf: ArrayBuffer, opts?: PenOrient): PenMesh {
  let raw: [V3, V3, V3][] = [];
  if (buf.byteLength >= 84) {
    const dv = new DataView(buf);
    const count = dv.getUint32(80, true);
    if (84 + count * 50 === buf.byteLength) raw = parseBinary(buf);
  }
  if (raw.length === 0) {
    // 退回 ASCII（也兜住二进制体积判定不严的情况）
    const text = new TextDecoder().decode(buf);
    if (/facet|vertex/i.test(text)) raw = parseAscii(text);
  }
  return buildMesh(raw, opts);
}
