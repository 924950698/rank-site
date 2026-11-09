#!/usr/bin/env node
// 拉取 X 趋势（/2/trends/by/woeid）写入 trends.json。令牌只从环境变量读取，不打印。
// 注：中国/香港/台湾 WOEID 在 X 上会回落为全球榜，故只取 全球/日本/美国/新加坡。
import { writeFileSync, renameSync } from "node:fs";
const T = process.env.X_BEARER_TOKEN;
if (!T) { console.error("X_BEARER_TOKEN not set"); process.exit(1); }
const REGIONS = [["global", "全球", 1], ["jp", "日本", 23424856], ["us", "美国", 23424977], ["sg", "新加坡", 23424948]];
const out = { updated: Date.now(), regions: [] };
for (const [key, name, woeid] of REGIONS) {
  let items = [], err = null;
  try {
    const r = await fetch(`https://api.x.com/2/trends/by/woeid/${woeid}?max_trends=20&trend.fields=trend_name,tweet_count`, { headers: { Authorization: `Bearer ${T}` } });
    const j = await r.json();
    if (!r.ok) err = `HTTP ${r.status}`;
    items = (j.data || []).filter(t => t.trend_name).map(t => {
      const o = { name: t.trend_name };
      if (Number.isFinite(t.tweet_count)) o.count = t.tweet_count;
      return o;
    });
  } catch (e) { err = String(e.message || e); }
  out.regions.push({ key, name, woeid, items, ...(err ? { error: err } : {}) });
  console.log(`${name}: ${items.length}${err ? " " + err : ""}`);
}
const f = new URL("../trends.json", import.meta.url);
writeFileSync(new URL("../trends.json.tmp", import.meta.url), JSON.stringify(out, null, 1) + "\n");
renameSync(new URL("../trends.json.tmp", import.meta.url), f);
