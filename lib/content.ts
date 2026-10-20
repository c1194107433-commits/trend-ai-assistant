export type ProductInput = {
  name: string;
  facts: string;
  audience: string;
  style: string;
};

export type NoteDraft = {
  titles: string[];
  selectedTitle: number;
  body: string;
  tags: string[];
};

export type Demo = {
  id: string;
  label: string;
  badge: string;
  input: ProductInput;
  note: NoteDraft;
};

export const emptyInput: ProductInput = {
  name: "", facts: "", audience: "", style: "活泼种草",
};

export const demos: Demo[] = [
  {
    id: "cloud",
    label: "云朵伙伴",
    badge: "虚构商品",
    input: {
      name: "云朵伙伴 · 桌面摆件（虚构示例）",
      facts: "用于课堂演示的虚构设计。\n原创云朵造型，奶白与淡紫配色，用于桌面陈列。\n未设定材质、尺寸、价格、库存、授权或销售渠道，也未设定为随机盲盒。\n没有购买或使用经历。",
      audience: "喜欢桌面布置的潮玩爱好者",
      style: "活泼种草",
    },
    note: {
      selectedTitle: 0,
      titles: ["给桌面留一朵小云 ☁️", "奶白遇见淡紫，桌面多一点趣味", "今天的桌面灵感：云朵伙伴"],
      body: "给桌面留一点可爱的空间 ☁️\n\n这次用虚构设计“云朵伙伴”做一个桌面布置的小提案：云朵造型搭配奶白与淡紫配色，让桌面陈列多一种有趣的选择。\n\n如果你喜欢潮玩摆件，可以先从造型和颜色出发，想想它与现有桌面的搭配：作为书桌上的视觉点缀，或放进你设想的陈列角落，让喜欢的元素有自己的位置。\n\n配色相近的物件可以放在一起，也可以试着留出一点空白，让云朵轮廓更容易被看见。这里只是在分享布置思路，实际大小和摆放效果还需要具体设计资料来确定。\n\n你会把这朵小云放在哪里？\n\n本商品为课堂虚构示例，不提供购买入口。",
      tags: ["潮玩", "桌面摆件", "桌面布置", "云朵造型", "配色灵感"],
    },
  },
  {
    id: "monsters",
    label: "慵懒瑜伽系列",
    badge: "文档案例 · 参数待核",
    input: {
      name: "THE MONSTERS 慵懒瑜伽系列手办盲盒",
      facts: "品牌：POP MART。\n系列：THE MONSTERS 慵懒瑜伽系列。\n品类：手办盲盒。\n以上来自项目需求文档，尚未独立核验官方页面，仅围绕系列名称中的主题写介绍草稿。\n未提供已核实的材质、尺寸、价格、库存、款式、配色和抽取规则，请省略，不自行补充。\n没有购买、开箱或使用经历。",
      audience: "喜欢 THE MONSTERS、关注主题潮玩的成年爱好者",
      style: "活泼种草",
    },
    note: {
      selectedTitle: 0,
      titles: ["THE MONSTERS 的慵懒瑜伽时间", "这次的潮玩话题：慵懒与瑜伽", "喜欢 THE MONSTERS？来聊聊这个主题"],
      body: "当“慵懒”遇上“瑜伽”，你会想到怎样的潮玩画面？🧘\n\n这次想介绍的是 POP MART 的 THE MONSTERS 慵懒瑜伽系列手办盲盒。先从系列名字出发，聊聊这个主题带来的想象：给忙碌的日常留一点慢下来的空间，也给喜欢的潮玩留一个话题。\n\n对于关注 THE MONSTERS 的朋友，主题可以是认识一个系列的起点。接下来，再结合官方商品图看看具体造型与细节，判断有没有自己喜欢的设计。挑选时不妨想想，你更看重角色本身，还是系列的表达方式？\n\n你对“慵懒瑜伽”的第一联想是什么？欢迎聊聊你的看法。具体款式、价格和抽取规则，请以购买页面为准。",
      tags: ["THEMONSTERS", "泡泡玛特", "潮玩", "手办盲盒", "慵懒瑜伽"],
    },
  },
];

export function formatNote(note: NoteDraft): string {
  const tags = note.tags
    .map((tag) => tag.trim().replace(/^[#＃]+/, "").trim())
    .filter(Boolean)
    .map((tag) => `#${tag}`)
    .join(" ");
  return [note.titles[note.selectedTitle]?.trim(), note.body.trim(), tags]
    .filter(Boolean)
    .join("\n\n");
}
