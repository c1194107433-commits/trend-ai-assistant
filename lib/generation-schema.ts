import type { NoteDraft, ProductInput } from "./content.ts";

export const MODEL = "deepseek-flash";
export const MAX_OUTPUT_TOKENS = 1800;
export const INPUT_LIMITS = { name: 160, facts: 6000, audience: 200 } as const;
export const STYLES = ["活泼种草", "简洁介绍", "细节分享"];

export function productInputErrors(input: ProductInput): Record<string, string> {
  const errors: Record<string, string> = {};
  const labels = { name: "商品名称", facts: "已确认的商品资料", audience: "目标人群" };
  for (const field of Object.keys(INPUT_LIMITS) as (keyof typeof INPUT_LIMITS)[]) {
    if (!input[field].trim()) errors[field] = `请填写${labels[field]}`;
    else if (input[field].length > INPUT_LIMITS[field]) {
      errors[field] = `${labels[field]}过长，最多 ${INPUT_LIMITS[field]} 个字符（部分表情按 2 个字符计算），请缩短后再生成。`;
    }
  }
  return errors;
}

export function validKey(value: unknown): value is string {
  return typeof value === "string" && /^[\x21-\x7E]{16,256}$/.test(value);
}

export function parseProduct(value: unknown): ProductInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  const output: Record<string, string> = {};
  for (const [field, limit] of Object.entries(INPUT_LIMITS)) {
    const text = object[field];
    if (typeof text !== "string" || !text.trim() || text.length > limit) return null;
    output[field] = text.trim();
  }
  if (typeof object.style !== "string" || !STYLES.includes(object.style)) return null;
  return { name: output.name, facts: output.facts, audience: output.audience, style: object.style };
}

export type GeneratedNote = { note: NoteDraft; notes: string[] };

export function parseGeneratedNote(value: unknown): GeneratedNote | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  function list(value: unknown, count: number, length: number): string[] | null {
    if (!Array.isArray(value) || value.length !== count ||
      !value.every((text) => typeof text === "string" && text.trim() && text.length <= length)) return null;
    return value.map((text: string) => text.trim());
  }
  const titles = list(data.titles, 3, 160);
  const rawTags = list(data.tags, 5, 40);
  if (!titles || !rawTags || typeof data.body !== "string" || !data.body.trim() || data.body.length > 4000) return null;
  const tags = rawTags.map((tag) => tag.replace(/^[#＃]+/, "").trim());
  if (tags.some((tag) => !tag || /[\r\n]/.test(tag)) || new Set(tags).size !== 5 || new Set(titles).size !== 3) return null;
  let notes: string[] = [];
  if (data.notes !== undefined) {
    if (!Array.isArray(data.notes) || data.notes.length > 5 ||
      !data.notes.every((text) => typeof text === "string" && text.trim() && text.length <= 200)) return null;
    notes = data.notes.map((text: string) => text.trim());
  }
  return { note: { titles, body: data.body.trim(), tags, selectedTitle: 0 }, notes };
}
