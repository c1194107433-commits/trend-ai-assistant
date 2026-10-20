import test from "node:test";
import assert from "node:assert/strict";
import { scanNote, scanText, riskCharacterPosition } from "../lib/risk.ts";
import { demos, formatNote } from "../lib/content.ts";

test("classroom example finds six distinct locations without overlapping price duplicates", () => {
  const hits = scanText("云朵伙伴全网最低价，官方授权，限量发售！亲测必出隐藏，买到必升值。");
  assert.equal(hits.length, 6);
  assert.deepEqual(hits.map((h) => h.rule.id), ["R02", "R05", "R07", "R08", "R03", "R04"]);
  assert.equal(hits[0].term, "全网最低价");
});

test("full-width matching retains exact original positions after emoji", () => {
  const text = "☁️ 🧸 １００％抽中隐藏款";
  const [hit] = scanText(text);
  assert.equal(hit.rule.id, "R03");
  assert.equal(text.slice(hit.start, hit.end), "１００％抽中");
  assert.equal(hit.term, "１００％抽中");
  assert.equal(riskCharacterPosition(hit), 6);
});

test("display position counts a supplementary emoji once without moving the highlight", () => {
  const [hit] = scanText("🧸保证抽中");
  assert.equal(riskCharacterPosition(hit), 2);
  assert.equal(hit.text.slice(hit.start, hit.end), "保证抽中");
  assert.equal(riskCharacterPosition(scanText("云朵保证抽中")[0]), 3);
});

test("overlapping phrases collapse per location but repeated occurrences remain", () => {
  const hits = scanText("全网最低价，真的全网最低价；稳赚翻倍，稳赚不赔。");
  assert.deepEqual(hits.map((h) => h.term), ["全网最低价", "全网最低价", "稳赚翻倍", "稳赚不赔"]);
});

test("negation and quotation remain reviewable; harmless broad words do not match", () => {
  assert.equal(scanText("不保证抽中隐藏款").length, 1);
  assert.equal(scanText("卖家声称‘必升值’，请核实").length, 1);
  assert.equal(scanText("最近第一次看官方商品图，治愈系配色，第一款云朵摆件。").length, 0);
});

test("all nine categories are covered", () => {
  const hits = scanText("无与伦比；全网最低价；必出隐藏；必升值；官方授权；零差评；限量；亲测；改善睡眠");
  assert.deepEqual(hits.map((h) => h.rule.id), Array.from({ length: 9 }, (_, i) => `R0${i + 1}`));
});

test("selected titles, body and tags are counted independently of unselected titles", () => {
  const note = structuredClone(demos[0].note);
  note.titles = ["全网最低价", "全网最低价", "云朵造型"];
  note.tags[0] = "#必出隐藏";
  const hits = scanNote(note);
  assert.equal(hits.filter((h) => h.included).length, 2);
  assert.equal(hits.filter((h) => !h.included).length, 1);
  note.selectedTitle = 2;
  assert.equal(scanNote(note).filter((h) => h.included).length, 1);
  note.tags[0] = "潮玩";
  assert.equal(scanNote(note).filter((h) => h.included).length, 0);
});

test("both supplied clean examples have no configured matches", () => {
  for (const demo of demos) assert.equal(scanNote(demo.note).length, 0);
  // No term match does not establish factual correctness.
  assert.equal(scanText("售价 64 元").length, 0);
});

test("copy uses selected edited title and current content, normalizes hashtags", () => {
  const note = { titles: ["旧标题", " 修改后的标题 ", "备用标题"], selectedTitle: 1, body: " 修改后的正文 ", tags: [" #潮玩 ", "＃桌面摆件", "", "云朵"] };
  assert.equal(formatNote(note), "修改后的标题\n\n修改后的正文\n\n#潮玩 #桌面摆件 #云朵");
});

test("fictional example preserves its disclosure in copied content", () => {
  const copied = formatNote(demos[0].note);
  assert.ok(copied.includes("本商品为课堂虚构示例，不提供购买入口。"));
  assert.ok(!copied.includes("未发现预设"));
});
