#!/bin/bash

# 1. ディレクトリ構造の作成
for t in bun browser node; do
  for f in esm no-esm iife; do
    mkdir -p "dist/js/$t/$f"
  done
done
mkdir -p dist/css
mkdir -p dist/ts/bun/esm # TSソース用のディレクトリを追加

# 2. CSSの基本コピー
cp src/css/warichu.css dist/css/code.css

# 3. 削除対象のconsoleメソッド定義
export CONSOLE_DROPS='["console.debug","console.log","console.assert","console.clear","console.count","console.countReset","console.dir","console.dirxml","console.group","console.groupCollapsed","console.groupEnd","console.profile","console.profileEnd","console.table","console.time","console.timeEnd","console.timeLog","console.timeStamp","console.trace"]'

# 4. ビルドプロセス実行
cat << 'EOF' > build_process.ts
import { build } from "bun";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";

//const unescape = (s: string) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
/**
 * Unicodeエスケープのうち、日本語の表示に必要な範囲のみをデコードする
 * 制御文字や特殊なフォーマット用文字はエスケープのまま維持する
 */
const unescape = (s: string) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => {
  const c = parseInt(h, 16);
  const isJapanese =
    (c >= 0x3000 && c <= 0x30FF) || // 句読点・かな
    (c >= 0x4E00 && c <= 0x9FFF) || // 常用漢字
    (c >= 0xFF00 && c <= 0xFFEF) || // 全角英数・記号
    (c >= 0x3400 && c <= 0x4DBF);   // 漢字拡張
  
  return isJapanese ? String.fromCharCode(c) : `\\u${h}`;
});

// エントリポイントの確認（src/ts か src/js かを自動判定）
let entry = "./src/ts/warichu.ts";
if (!existsSync(entry)) {
  entry = "./src/js/warichu.ts";
}
if (!existsSync(entry)) {
  console.error("エラー: エントリポイントが見つかりません (src/ts/warichu.ts または src/js/warichu.ts)");
  process.exit(1);
}

const drops = JSON.parse(process.env.CONSOLE_DROPS!);
const targets = ["bun", "browser", "node"] as const;
const releases = [
  { name: "debug", minify: false, drop: [] },
  { name: "code",  minify: false, drop: drops },
  { name: "min",   minify: true,  drop: drops }
];

for (const target of targets) {
  for (const release of releases) {
    const baseDir = `dist/js/${target}`;
    const common = { 
      entrypoints: [entry], 
      minify: release.minify, 
      drop: release.drop as any[], 
      target: target as any 
    };

    // --- A. ESM ビルド ---
    const esmRes = await build({ ...common, format: "esm" });
    if (!esmRes.success) throw new Error(esmRes.logs.join("\n"));
    const esmCode = await esmRes.outputs[0].text(); 
    writeFileSync(`${baseDir}/esm/${release.name}.js`, unescape(esmCode));

    // --- B. NO-ESM ビルド ---
    // 1. まず非ミニファイでビルドして export を除去
    const noEsmBaseRes = await build({ ...common, format: "esm", minify: false });
    let noEsmCode = await noEsmBaseRes.outputs[0].text();
    
    noEsmCode = noEsmCode
      .replace(/^export\s+(class|const|let|var|function|type|interface)\s+/gm, "$1 ")
      .replace(/\nexport\s*\{[\s\S]*?\};?\s*$/g, "");

    // 2. ミニファイが必要な場合は、export除去後のコードを一時ファイルに書き出して再ビルド
    if (release.minify) {
      const tempFile = `./.temp_no_esm.js`;
      writeFileSync(tempFile, noEsmCode);
      const minRes = await build({ entrypoints: [tempFile], minify: true, target: target as any });
      if (minRes.success) {
        noEsmCode = await minRes.outputs[0].text();
      }
      unlinkSync(tempFile);
    }
    writeFileSync(`${baseDir}/no-esm/${release.name}.js`, unescape(noEsmCode));

    // --- C. IIFE ビルド ---
    const iifeRes = await build({ ...common, format: "iife" });
    if (!iifeRes.success) throw new Error(iifeRes.logs.join("\n"));
    const iifeCode = await iifeRes.outputs[0].text();
    writeFileSync(`${baseDir}/iife/${release.name}.js`, unescape(iifeCode));
  }
}

// CSSのミニファイ
const cssSrc = readFileSync("src/css/warichu.css", "utf-8");
const cssMin = cssSrc
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\s+/g, " ")
  .replace(/\s*([\{\}\:\;\,])\s*/g, "$1")
  .trim();
writeFileSync("dist/css/min.css", cssMin);
EOF

# ビルド実行
bun run build_process.ts || exit 1
rm build_process.ts

# 5. 原本ソースコード(TS)を配布用にコピー
cp src/ts/warichu.ts dist/ts/bun/esm/source.ts

echo "ビルド完了：27パターンのJSとCSSを生成しました。"
