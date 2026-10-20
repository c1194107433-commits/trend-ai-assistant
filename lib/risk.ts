import type { NoteDraft } from "./content.ts";

type Rule = {
  id: string;
  name: string;
  level: "建议修改" | "需要核实";
  terms: string[];
  reason: string;
  advice: string;
};

export const rules: Rule[] = [
  { id: "R01", name: "优越性比较", level: "建议修改", terms: ["最好", "最佳", "最强", "顶级", "无与伦比", "全网第一"], reason: "含强烈的优越性或比较表达，需要检查范围和依据。", advice: "改为已提供的造型、配色或材质等具体特点，不补充未知事实。" },
  { id: "R02", name: "价格比较", level: "需要核实", terms: ["全网最低", "全网最低价", "史上最低", "最低价"], reason: "跨渠道或历史价格比较需要对应依据。", advice: "无比较依据时删除比较；有价格资料时写清规格、渠道及时间。" },
  { id: "R03", name: "抽取保证", level: "建议修改", terms: ["必出隐藏", "包出隐藏", "必中隐藏", "百分百抽中", "100%抽中", "保证抽中", "抽到为止"], reason: "可能表达确定抽中，或鼓励持续抽取。", advice: "删除保证，仅介绍已核实的抽取规则，不编造概率。" },
  { id: "R04", name: "收藏收益承诺", level: "建议修改", terms: ["稳赚不赔", "稳赚", "必升值", "保证升值", "稳赚翻倍"], reason: "将商品收藏描述为确定获利。", advice: "删除收益承诺，回到商品设计特点和个人偏好。" },
  { id: "R05", name: "授权或来源", level: "需要核实", terms: ["官方授权", "官方正品", "官方直营", "官方认证", "独家授权"], reason: "销售身份、授权和来源不能由品牌名称推导。", advice: "核对授权及销售主体；没有依据时删除相关背书。" },
  { id: "R06", name: "销量或口碑", level: "需要核实", terms: ["销量第一", "全网爆款", "全网都在买", "人人都爱", "零差评", "好评率100%", "100%好评"], reason: "销量、评价数据和普遍偏好需要来源及统计范围。", advice: "删除无依据的数据，不把少量评论推广为所有用户观点。" },
  { id: "R07", name: "稀缺性或时限", level: "需要核实", terms: ["仅剩", "最后一件", "最后一批", "限量", "绝版", "即将售罄", "错过不再", "限时抢购"], reason: "库存、生产状态和活动时限可能随时间变化。", advice: "核实当前库存及活动信息；没有依据时删除紧迫性表达。" },
  { id: "R08", name: "亲身经历", level: "需要核实", terms: ["亲测", "实测", "我买了", "我入手了", "我抽到了", "开箱后发现"], reason: "可能暗示作者实际购买或体验。", advice: "有真实经历且符合叙述身份时可保留，否则改为客观介绍。" },
  { id: "R09", name: "健康效果承诺", level: "建议修改", terms: ["治愈焦虑", "治疗焦虑", "治疗失眠", "缓解抑郁", "改善睡眠", "抗抑郁"], reason: "普通潮玩资料不足以支持具体健康效果。", advice: "删除功效承诺，可描述已知造型、配色及主观审美感受。" },
];

export type RiskHit = {
  rule: Rule;
  term: string;
  start: number;
  end: number;
  text: string;
  field: string;
  label: string;
  included: boolean;
};

// Match offsets stay UTF-16 for slicing; visible positions use the same
// Unicode code-point counting as the editor's character counter.
export function riskCharacterPosition(hit: RiskHit): number {
  return Array.from(hit.text.slice(0, hit.start)).length + 1;
}

// Only convert width and ASCII case. Each replacement keeps UTF-16 length,
// so match offsets still refer to the exact original text, including emoji.
function normalize(text: string): string {
  return text
    .replace(/[\uFF01-\uFF5E]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[A-Z]/g, (char) => char.toLowerCase());
}

export function scanText(text: string, field = "body", label = "正文", included = true): RiskHit[] {
  const normalized = normalize(text);
  const hits: RiskHit[] = [];
  for (const rule of rules) {
    const candidates: RiskHit[] = [];
    for (const term of rule.terms) {
      const needle = normalize(term);
      let cursor = normalized.indexOf(needle);
      while (cursor !== -1) {
        candidates.push({
          rule, term: text.slice(cursor, cursor + needle.length), start: cursor,
          end: cursor + needle.length, text, field, label, included,
        });
        cursor = normalized.indexOf(needle, cursor + 1);
      }
    }
    const accepted: RiskHit[] = [];
    candidates.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
    for (const candidate of candidates) {
      if (!accepted.some((hit) => candidate.start < hit.end && candidate.end > hit.start)) {
        accepted.push(candidate);
      }
    }
    hits.push(...accepted);
  }
  return hits.sort((a, b) => a.start - b.start || a.rule.id.localeCompare(b.rule.id));
}

export function scanNote(note: NoteDraft): RiskHit[] {
  return [
    ...note.titles.flatMap((title, index) => scanText(
      title, `title-${index}`, `标题 ${index + 1}（${note.selectedTitle === index ? "已选" : "未选"}）`,
      note.selectedTitle === index,
    )),
    ...scanText(note.body),
    ...note.tags.flatMap((tag, index) => scanText(tag, `tag-${index}`, `话题 ${index + 1}`)),
  ];
}
