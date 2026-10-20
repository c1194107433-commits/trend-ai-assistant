import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "潮玩种草 AI 助手 · 内容创作工作台",
  description: "从真实商品资料到可编辑的潮玩种草笔记。课堂演示版，提供样例编辑、表达检查与复制。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
