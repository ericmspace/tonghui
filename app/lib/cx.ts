/** 极简 className 合并工具（避免引入额外依赖） */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
