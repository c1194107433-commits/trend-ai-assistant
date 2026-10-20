"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { demos, emptyInput, formatNote, type NoteDraft, type ProductInput } from "@/lib/content";
import { scanNote, type RiskHit } from "@/lib/risk";
import { parseGeneratedNote, validKey } from "@/lib/generation-schema";

function Icon({ name, size = 20 }: { name: "spark" | "copy" | "shield" | "arrow" | "close" | "book" | "info" | "check"; size?: number }) {
  const paths = {
    spark: <><path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z"/><path d="m20 2 .6 1.4L22 4l-1.4.6L20 6l-.6-1.4L18 4l1.4-.6L20 2Z"/></>,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
    arrow: <><path d="M4 12h15m-6-6 6 6-6 6"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    book: <><path d="M12 5v15M3 4h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v15h-5a5 5 0 0 0-4 1 5 5 0 0 0-4-1H3V4Z"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function RiskItem({ hit }: { hit: RiskHit }) {
  const from = Math.max(0, hit.start - 18);
  const to = Math.min(hit.text.length, hit.end + 22);
  return <li className="risk-item">
    <div className="risk-item-heading"><span className="risk-category">{hit.rule.level}</span><strong>{hit.rule.name}</strong><span>{hit.label} · 第 {hit.start + 1} 位</span></div>
    <p className="risk-excerpt">{from > 0 ? "…" : ""}{hit.text.slice(from, hit.start)}<mark>{hit.term}</mark>{hit.text.slice(hit.end, to)}{to < hit.text.length ? "…" : ""}</p>
    <p>{hit.rule.reason} {hit.rule.advice}</p>
  </li>;
}

export default function Home() {
  const [input, setInput] = useState<ProductInput>({ ...emptyInput });
  const [note, setNote] = useState<NoteDraft | null>(null);
  const [sourceInput, setSourceInput] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generationMessage, setGenerationMessage] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [keyError, setKeyError] = useState("");
  const [keyConsent, setKeyConsent] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [noteOrigin, setNoteOrigin] = useState<"sample" | "ai">("sample");
  const [generationNotes, setGenerationNotes] = useState<string[]>([]);
  const [usage, setUsage] = useState<{ inputTokens: number; outputTokens: number } | null>(null);
  const [notice, setNotice] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const previewRef = useRef<HTMLDialogElement>(null);
  const copyRef = useRef<HTMLDialogElement>(null);
  const settingsRef = useRef<HTMLDialogElement>(null);
  const confirmGenerateRef = useRef<HTMLDialogElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedDemo = demos[demoIndex];
  const hits = useMemo(() => note ? scanNote(note) : [], [note]);
  const activeHits = hits.filter((hit) => hit.included);
  const otherHits = hits.filter((hit) => !hit.included);
  const stale = note && sourceInput !== JSON.stringify(input);

  useEffect(() => {
    if (previewOpen) previewRef.current?.showModal();
    else previewRef.current?.close();
  }, [previewOpen]);
  useEffect(() => {
    if (copyFallback !== null) copyRef.current?.showModal();
    else copyRef.current?.close();
  }, [copyFallback]);
  useEffect(() => {
    if (settingsOpen) settingsRef.current?.showModal();
    else settingsRef.current?.close();
  }, [settingsOpen]);
  useEffect(() => {
    if (confirmGenerate) confirmGenerateRef.current?.showModal();
    else confirmGenerateRef.current?.close();
  }, [confirmGenerate]);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);
  useEffect(() => () => { activeRequest.current?.abort(); }, []);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (note || input.name || input.facts || input.audience || apiKey) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [note, input, apiKey]);

  function announce(text: string) {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = setTimeout(() => setNotice(""), 5000);
  }
  function updateInput(key: keyof ProductInput, value: string) {
    setInput((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: "" }));
    setGenerationMessage("");
  }
  function openSettings() {
    if (activeRequest.current) return;
    setKeyDraft("");
    setKeyError("");
    setKeyConsent(false);
    setSettingsOpen(true);
  }
  function saveKey(event: React.FormEvent) {
    event.preventDefault();
    const nextKey = keyDraft.trim();
    if (!validKey(nextKey)) {
      setKeyError("请粘贴完整 Key，检查是否含空格或换行。");
      return;
    }
    if (!keyConsent) {
      setKeyError("请先确认费用承担与密钥传输说明。");
      return;
    }
    setApiKey(nextKey);
    setConnected(false);
    setKeyDraft("");
    setKeyConsent(false);
    setSettingsOpen(false);
    setGenerationMessage("");
    announce("Key 已配置。首次成功生成后才会显示连接正常。");
  }
  function clearKey() {
    activeRequest.current?.abort();
    setApiKey("");
    setKeyDraft("");
    setConnected(false);
    setKeyConsent(false);
    setKeyError("");
    announce("已清除当前页面保存的 Key。");
  }
  function openPreview() {
    if (activeRequest.current) return;
    setConfirmReplace(false);
    setPreviewOpen(true);
  }
  function loadExample() {
    if (activeRequest.current) return;
    if (!confirmReplace && (note || input.name || input.facts || input.audience)) {
      setConfirmReplace(true);
      return;
    }
    setInput({ ...selectedDemo.input });
    setNote(structuredClone(selectedDemo.note));
    setSourceInput(JSON.stringify(selectedDemo.input));
    setSourceLabel(selectedDemo.badge);
    setErrors({});
    setGenerationMessage("");
    setNoteOrigin("sample");
    setGenerationNotes([]);
    setUsage(null);
    setNotice("");
    setPreviewOpen(false);
    setConfirmReplace(false);
    announce("预设样例已载入，可以选择标题、修改正文并复制。");
  }
  function generate(event: React.FormEvent) {
    event.preventDefault();
    if (activeRequest.current) return;
    const nextErrors: Record<string, string> = {};
    if (!input.name.trim()) nextErrors.name = "请填写商品名称";
    if (!input.facts.trim()) nextErrors.facts = "请填写已确认的商品资料";
    if (!input.audience.trim()) nextErrors.audience = "请填写目标人群";
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) {
      document.getElementById(`product-${first}`)?.focus();
      return;
    }
    if (!apiKey) {
      openSettings();
      return;
    }
    if (note) {
      setConfirmGenerate(true);
      return;
    }
    void runGeneration();
  }
  async function runGeneration() {
    if (activeRequest.current || !apiKey) return;
    setConfirmGenerate(false);
    const snapshot = { ...input };
    const controller = new AbortController();
    activeRequest.current = controller;
    setIsGenerating(true);
    setGenerationMessage("");
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 70_000);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, input: snapshot }),
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      const data = await response.json().catch(() => {
        throw new Error("服务返回了无法读取的响应，原有内容已保留。请稍后手动重试。");
      });
      if (!response.ok) {
        if (data.code === "INVALID_KEY") {
          setConnected(false);
          setApiKey("");
        }
        // Only our own route returns these sanitized messages.
        throw new Error(typeof data.error === "string" ? data.error : "本次生成未完成，请稍后手动重试。");
      }
      if (controller.signal.aborted) return;
      const parsed = parseGeneratedNote({ ...data.note, notes: data.notes });
      if (!parsed) throw new Error("返回内容不完整，原有内容已保留。本次请求可能已计费。");
      setNote(parsed.note);
      setSourceInput(JSON.stringify(snapshot));
      setSourceLabel("DeepSeek Flash · AI 草稿");
      setNoteOrigin("ai");
      setGenerationNotes(parsed.notes);
      setConnected(true);
      setUsage(data.usage && Number.isSafeInteger(data.usage.inputTokens) && Number.isSafeInteger(data.usage.outputTokens)
        ? data.usage : null);
      announce("笔记已生成，请核对商品事实和表达提示后使用。");
    } catch (error) {
      if (controller.signal.aborted) {
        setGenerationMessage(timedOut
          ? "等待超时，原有资料和文案已保留。已处理的请求仍可能计费，请稍后手动重试。"
          : "已停止等待，原有资料和文案已保留。已处理的请求仍可能计费。");
      } else {
        setGenerationMessage(error instanceof Error && !(error instanceof TypeError)
          ? error.message : "网络连接失败，原有内容已保留。请稍后手动重试。");
      }
    } finally {
      clearTimeout(timer);
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setIsGenerating(false);
      }
    }
  }
  async function copyNote() {
    if (!note) return;
    const currentHits = scanNote(note).filter((hit) => hit.included);
    const text = formatNote(note);
    if (!note.titles[note.selectedTitle]?.trim() || !note.body.trim()) {
      announce("请先填写选中的标题和正文，再复制。");
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      announce(currentHits.length ? `已复制，当前成稿还有 ${currentHits.length} 处表达待复核。` : "已复制完整笔记，请核对后使用。");
    } catch {
      setCopyFallback(text);
    }
  }

  return <>
    <a className="skip-link" href="#workspace">跳转到工作区</a>
    <header className="site-header">
      <a className="brand" href="/" aria-label="潮玩种草 AI 助手首页"><span className="brand-mark"><Icon name="spark" size={23}/></span><span>潮玩种草 <b>AI</b> 助手</span></a>
      <span className="header-tag">内容创作工作台</span>
      <div className="header-actions"><span className="local-status"><i/>{connected ? "DeepSeek 已连接" : apiKey ? "Key 已配置" : "使用自己的 Key"}</span><button className="button outline small ai-settings-button" onClick={openSettings} disabled={isGenerating}><Icon name="spark" size={16}/>AI 设置</button><button className="button outline small" onClick={openPreview} disabled={isGenerating}><Icon name="book" size={17}/>查看演示样例</button></div>
    </header>

    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-art" aria-hidden="true"/>
        <div className="hero-inner">
          <div className="hero-eyebrow"><span/> TOY STORIES, YOUR WAY <span className="mini-sticker">灵感营业中</span></div>
          <h1 id="hero-title">让好玩的商品，<br className="mobile-break"/>有<span className="underline-accent">好看的表达</span></h1>
          <p>填写真实资料，把潮玩灵感变成下一篇种草笔记。</p>
          <div className="hero-pills"><span><Icon name="spark" size={14}/>灵感成文</span><span><Icon name="shield" size={14}/>表达自检</span><span><Icon name="copy" size={14}/>自由编辑</span></div>
        </div>
      </section>

      <div className="workspace-top"><div className="breadcrumbs">创作工作台 <span>/</span> <strong>种草笔记</strong></div><span>从商品资料，到你的表达 <Icon name="arrow" size={15}/></span></div>
      <div className="workspace" id="workspace">
        <section className="panel input-panel" aria-labelledby="input-heading">
          <div className="panel-heading"><div className="section-title"><span className="step">01</span><h2 id="input-heading">商品资料</h2></div><span className="section-caption">灵感从这里开始</span></div>
          <form onSubmit={generate} noValidate>
            <fieldset disabled={isGenerating} className="generation-lock" aria-label="商品输入">
            <div className="field">
              <label htmlFor="product-name">商品名称 <span className="required">*</span></label>
              <input id="product-name" value={input.name} maxLength={160} placeholder="例如：某个潮玩系列或桌面摆件" onChange={(event) => updateInput("name", event.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? "error-name" : undefined}/>
              {errors.name && <p className="field-error" id="error-name">{errors.name}</p>}
            </div>
            <div className="field">
              <label htmlFor="product-facts">真实商品资料 <span className="required">*</span></label>
              <textarea id="product-facts" value={input.facts} maxLength={6000} rows={6} placeholder={"写下已确认的商品特点，例如：\n· 造型与配色\n· 材质、尺寸或款式\n· 希望介绍的设计细节"} onChange={(event) => updateInput("facts", event.target.value)} aria-invalid={!!errors.facts} aria-describedby={`facts-help${errors.facts ? " error-facts" : ""}`}/>
              <div className="field-meta"><span id="facts-help">不清楚的价格、库存或概率，请不要猜测</span><span>{input.facts.length}/6000</span></div>
              {errors.facts && <p className="field-error" id="error-facts">{errors.facts}</p>}
            </div>
            <div className="field">
              <label htmlFor="product-audience">目标人群 <span className="required">*</span></label>
              <input id="product-audience" value={input.audience} maxLength={200} placeholder="例如：喜欢桌面布置的潮玩爱好者" onChange={(event) => updateInput("audience", event.target.value)} aria-invalid={!!errors.audience} aria-describedby={errors.audience ? "error-audience" : undefined}/>
              {errors.audience && <p className="field-error" id="error-audience">{errors.audience}</p>}
            </div>
            <fieldset className="style-field"><legend>文案风格 <span>选一种表达方式</span></legend><div className="style-options">{["活泼种草", "简洁介绍", "细节分享"].map((style, index) =>
              <label className={`style-option ${input.style === style ? "selected" : ""}`} key={style}><input type="radio" name="style" value={style} checked={input.style === style} onChange={() => updateInput("style", style)}/><span aria-hidden="true">{["✦", "≡", "◈"][index]}</span>{style}</label>
            )}</div></fieldset>
            </fieldset>
            <p className="input-note"><Icon name="info" size={15}/>仅使用真实资料，生成费用由你的 DeepSeek 账户承担</p>
            <button type="submit" className="button primary generate-button" disabled={isGenerating}><Icon name="spark"/>{isGenerating ? "正在生成笔记…" : "生成笔记"}<Icon name="arrow" size={18}/></button>
            <p className="connection-note"><span/>{apiKey ? "DeepSeek Flash · 一次生成标题、正文和话题" : "未配置 Key · 查看演示样例无需付费调用"}</p>
            {isGenerating && <div className="generation-progress" role="status"><p>正在等待 DeepSeek，已有内容会保留到生成成功。</p><button type="button" className="text-button" onClick={() => activeRequest.current?.abort()}>停止等待</button><small>停止等待后，已处理的请求仍可能计费。</small></div>}
            {generationMessage && <div className="generation-message" role="alert"><p>{generationMessage}</p><div className="message-actions"><button type="button" className="text-button" onClick={openSettings}>AI 设置</button><button type="button" className="text-button" onClick={openPreview}>查看预设样例 <Icon name="arrow" size={15}/></button></div></div>}
          </form>
        </section>

        <section className="panel output-panel" aria-labelledby="output-heading">
          <div className="panel-heading"><div className="section-title"><span className="step purple">02</span><h2 id="output-heading">笔记工作区</h2></div><span className="badge">{isGenerating ? "正在生成…" : note ? noteOrigin === "ai" ? "AI 生成 · 请人工复核" : "预设样例 · 非实时生成" : "等一份好灵感"}</span></div>
          {note ? <fieldset disabled={isGenerating} className="editor-content generation-lock" aria-label="笔记编辑">
            <div className="draft-meta"><span><i/>{sourceLabel}</span><span>可直接编辑</span></div>
            {stale && <p className="stale-note" role="status"><Icon name="info" size={16}/>商品资料已修改，当前笔记仍基于上一次生成或载入的资料。</p>}
            {generationNotes.length > 0 && <div className="generation-notes"><strong>资料核对提醒</strong><ul>{generationNotes.map((text, index) => <li key={index}>{text}</li>)}</ul></div>}
            <fieldset className="titles-field"><legend>标题候选 <span>选一个喜欢的，也可以改一改</span></legend><div className="title-options">{note.titles.map((title, index) =>
              <div className={`title-option ${note.selectedTitle === index ? "selected" : ""}`} key={index}>
                <input type="radio" name="title" aria-label={`选用标题 ${index + 1}`} checked={note.selectedTitle === index} onChange={() => setNote({ ...note, selectedTitle: index })}/>
                <input aria-label={`标题 ${index + 1}`} value={title} maxLength={160} onChange={(event) => setNote({ ...note, titles: note.titles.map((old, i) => i === index ? event.target.value : old) })}/>
                <span className="title-number">0{index + 1}</span>
              </div>
            )}</div></fieldset>
            <div className="body-label"><label htmlFor="note-body">正文</label><span>{Array.from(note.body).length} 字符</span></div>
            <textarea id="note-body" className="note-body" value={note.body} maxLength={12000} onChange={(event) => setNote({ ...note, body: event.target.value })} spellCheck={false}/>
            <fieldset className="tags-field"><legend>话题标签 <span>相关话题，不代表实时热度</span></legend><div className="tags">{note.tags.map((tag, index) =>
              <label className="tag" key={index}><span aria-hidden="true">#</span><input aria-label={`话题 ${index + 1}`} value={tag} maxLength={40} style={{ width: `${Math.max(4, Math.min(18, Array.from(tag).length * 1.1))}em` }} onChange={(event) => setNote({ ...note, tags: note.tags.map((old, i) => i === index ? event.target.value : old) })}/></label>
            )}</div></fieldset>
            <div className={`review-summary ${activeHits.length ? "has-risks" : ""}`} role="status">
              <Icon name="shield" size={20}/><strong>表达自检</strong><span>{activeHits.length ? `当前成稿有 ${activeHits.length} 处表达待复核` : "未发现预设风险表达，仍请人工复核"}</span>
            </div>
            {activeHits.length > 0 && <details className="risk-details" open><summary>查看提示与修改建议 <span>{activeHits.length}</span></summary><ul>{activeHits.map((hit) => <RiskItem key={`${hit.field}-${hit.rule.id}-${hit.start}`} hit={hit}/>)}</ul><p className="context-note">引用、否定句及有依据的表述也可能命中，请结合上下文判断。</p></details>}
            {otherHits.length > 0 && <details className="risk-details secondary-risks"><summary>未选标题的提示 <span>{otherHits.length}</span></summary><ul>{otherHits.map((hit) => <RiskItem key={`${hit.field}-${hit.rule.id}-${hit.start}`} hit={hit}/>)}</ul><p className="context-note">这些提示不计入当前成稿。引用或否定表达请结合上下文判断。</p></details>}
            <div className="copy-row"><p>预设词表辅助检查，不代表平台审核结果。{usage && <span className="usage-note">本次用量：输入 {usage.inputTokens} / 输出 {usage.outputTokens} token<br/>费用以 DeepSeek 账户账单为准。</span>}</p><button className="button dark" onClick={copyNote}><Icon name="copy" size={18}/>复制完整笔记</button></div>
          </fieldset> : <div className="empty-state">
            <div className="empty-art" aria-hidden="true"><span className="orbit orbit-one">✦</span><span className="orbit orbit-two">✧</span><div className="paper-preview"><div className="paper-label">TOY NOTES</div><span className="paper-cloud">☁</span><div className="paper-line"/><div className="paper-line short"/><div className="paper-tags"><i/><i/><i/></div></div><span className="empty-sticker">好灵感，待发生</span></div>
            <h3>给你的潮玩，一个出场方式</h3>
            <p>标题、正文、话题和表达提示<br/>将在这里组成一篇可修改的笔记。</p>
            <button className="button empty-demo" onClick={openPreview} disabled={isGenerating}><Icon name="book" size={18}/>先看看演示样例<Icon name="arrow" size={16}/></button>
            <div className="empty-features"><span>3 个标题</span><i/><span>1 篇正文</span><i/><span>5 个话题</span></div>
          </div>}
        </section>
      </div>
      <footer><span><Icon name="info" size={14}/>内容仅保留在当前页面，请及时复制保存。</span><span>品牌插画为原创视觉设定 · 非商品实拍</span></footer>
    </main>
    <div className={`toast ${notice ? "visible" : ""}`} role="status" aria-live="polite">{notice && <><Icon name="info" size={18}/>{notice}</>}</div>

    <dialog ref={settingsRef} className="settings-dialog" aria-labelledby="settings-heading" onClose={() => { setSettingsOpen(false); setKeyDraft(""); setKeyConsent(false); setKeyError(""); }}>
      <div className="dialog-header"><div><p className="eyebrow">YOUR KEY, YOUR CONTROL</p><h2 id="settings-heading">连接你的 DeepSeek</h2></div><button className="icon-button" aria-label="关闭 AI 设置" onClick={() => setSettingsOpen(false)}><Icon name="close"/></button></div>
      <form className="settings-form" onSubmit={saveKey}>
        <div className="provider-card"><span className="provider-icon"><Icon name="spark" size={24}/></span><div><strong>DeepSeek Flash</strong><p>非思考模式 · 一次生成完整笔记</p></div><span className="badge">{connected ? "连接正常" : apiKey ? "已配置 · 待验证" : "未配置"}</span></div>
        <div className="settings-explainer"><p>使用你自己的 Key，生成费用由你的 DeepSeek 账户承担。网站不提供公共额度。</p><p>Key 和商品资料会经本站后台发送至 DeepSeek 官方接口。应用不持久保存 Key；页面刷新或关闭后需重新填写。</p></div>
        <div className="field"><label htmlFor="deepseek-key">{apiKey ? "更换 API Key" : "DeepSeek API Key"}</label><input id="deepseek-key" name="deepseek-key" type="password" autoComplete="off" spellCheck={false} autoCapitalize="none" maxLength={256} value={keyDraft} onChange={(event) => { setKeyDraft(event.target.value); setKeyError(""); }} placeholder={apiKey ? "留空不会改变当前 Key；更换时粘贴新 Key" : "粘贴你的 DeepSeek API Key"} aria-invalid={!!keyError} aria-describedby="key-help"/><p id="key-help" className="key-help">仅在当前页面暂存，不写入浏览器长期存储。不要使用不信任的网站保存 Key。</p>{keyError && <p className="field-error" role="alert">{keyError}</p>}</div>
        <a className="key-link" href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer">前往 DeepSeek 官方平台获取 Key ↗</a>
        <label className="consent-label"><input type="checkbox" checked={keyConsent} onChange={(event) => setKeyConsent(event.target.checked)}/><span>我了解 Key 会经本站后台转发至 DeepSeek，生成费用由我的账户承担。</span></label>
        <p className="settings-footnote">保存设置不会调用 AI 或产生模型费用。首次生成成功后才会确认连接正常；超时或停止等待不保证免计费。</p>
        <div className="settings-actions"><button type="button" className="button outline" onClick={clearKey} disabled={!apiKey && !keyDraft}>清除 Key</button><button type="submit" className="button primary" disabled={!keyConsent || !keyDraft.trim()}>保存设置</button></div>
      </form>
    </dialog>

    <dialog ref={confirmGenerateRef} className="confirm-dialog" aria-labelledby="generate-confirm-heading" onClose={() => setConfirmGenerate(false)}>
      <div className="dialog-header"><h2 id="generate-confirm-heading">生成一篇新的笔记？</h2><button className="icon-button" aria-label="关闭生成确认" onClick={() => setConfirmGenerate(false)}><Icon name="close"/></button></div>
      <div className="confirm-body"><p>成功后将替换当前标题、正文和标签。需要保留的修改请先复制；如果生成失败，原有内容会保留。</p><p>本次使用你配置的 DeepSeek Key，可能产生模型费用。</p></div>
      <div className="dialog-footer"><button className="button outline" onClick={() => setConfirmGenerate(false)}>先保留当前内容</button><button className="button primary" onClick={() => void runGeneration()}>确认生成</button></div>
    </dialog>

    <dialog ref={previewRef} className="sample-dialog" aria-labelledby="sample-heading" onClose={() => { setPreviewOpen(false); setConfirmReplace(false); }}>
      <div className="dialog-header"><div><p className="eyebrow">GET INSPIRED</p><h2 id="sample-heading">从一个样例开始</h2></div><button className="icon-button" aria-label="关闭样例" onClick={() => setPreviewOpen(false)}><Icon name="close"/></button></div>
      <div className="dialog-tabs" role="group" aria-label="选择演示商品">{demos.map((demo, index) => <button key={demo.id} className={index === demoIndex ? "active" : ""} aria-pressed={index === demoIndex} onClick={() => { setDemoIndex(index); setConfirmReplace(false); }}>{demo.label}<span>{demo.badge}</span></button>)}</div>
      <div className="sample-notice"><Icon name="info" size={17}/>预设示例，非实时 AI 生成。查看样例不会覆盖工作区。</div>
      <div className="sample-content"><div className="sample-facts"><h3>商品输入</h3><strong>{selectedDemo.input.name}</strong><p>{selectedDemo.input.facts}</p><h4>目标人群</h4><p>{selectedDemo.input.audience}</p><h4>文案风格</h4><span className="badge">{selectedDemo.input.style}</span></div><div className="sample-note"><h3>文案参考</h3><ol>{selectedDemo.note.titles.map((title) => <li key={title}>{title}</li>)}</ol><p>{selectedDemo.note.body}</p><div className="sample-tags">{selectedDemo.note.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></div></div>
      <div className="dialog-footer">{confirmReplace ? <div className="replace-confirm" role="alert"><strong>载入会替换当前资料和文案。</strong><p>需要保留的内容请先复制。是否继续？</p><div><button className="button outline" onClick={() => setConfirmReplace(false)}>返回</button><button className="button primary" onClick={loadExample}>确认替换并载入</button></div></div> : <><p>载入后可体验标题选择、编辑、检查与复制。</p><button className="button primary" onClick={loadExample}>载入工作区<Icon name="arrow" size={17}/></button></>}</div>
    </dialog>

    <dialog ref={copyRef} className="copy-dialog" onClose={() => setCopyFallback(null)} aria-labelledby="copy-heading">
      <div className="dialog-header"><h2 id="copy-heading">请手动复制笔记</h2><button className="icon-button" aria-label="关闭手动复制" onClick={() => setCopyFallback(null)}><Icon name="close"/></button></div>
      <p>浏览器未能写入剪贴板。点击下方文本全选，然后按 ⌘C 或 Ctrl+C 复制。</p>
      <textarea aria-label="待复制的完整笔记" readOnly value={copyFallback ?? ""} onFocus={(event) => event.currentTarget.select()} onClick={(event) => event.currentTarget.select()}/>
    </dialog>
  </>;
}
