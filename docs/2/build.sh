#!/bin/bash

# 出力ディレクトリの作成
mkdir -p dist/css dist/js/max dist/js/min

# CSSのコピー
cp src/css/warichu.css dist/css/warichu.css

# ビルドプロセス実行
cat << 'EOF' > build_process.ts
import { build } from "bun";

const entry = "src/js/warichu.ts";

const specs = [
  // MAX (Minifyなし)
  { name: "bun.js",           format: "esm",  minify: false, outdir: "dist/js/max", target: "bun" },
  { name: "bun.ts",           format: "esm",  minify: false, outdir: "dist/js/max", target: "bun" },
  { name: "browser-module.js", format: "esm",  minify: false, outdir: "dist/js/max", target: "browser" },
  { name: "browser-script.js", format: "iife", minify: false, outdir: "dist/js/max", target: "browser" },
  
  // MIN (Minifyあり)
  { name: "bun.js",           format: "esm",  minify: true,  outdir: "dist/js/min", target: "bun" },
  { name: "bun.ts",           format: "esm",  minify: true,  outdir: "dist/js/min", target: "bun" },
  { name: "browser-module.js", format: "esm",  minify: true,  outdir: "dist/js/min", target: "browser" },
  { name: "browser-script.js", format: "iife", minify: true,  outdir: "dist/js/min", target: "browser" },
];

for (const s of specs) {
  const result = await build({
    entrypoints: [entry],
    outdir: s.outdir,
    minify: s.minify,
    format: s.format as any,
    naming: s.name,
    target: s.target as any,
  });
  
  if (!result.success) {
    console.error(`Build failed for ${s.name}:`, result.logs);
    process.exit(1);
  }
}
EOF

bun run build_process.ts
rm build_process.ts

echo "Build complete. (Note: browser-es5.js excluded due to Bun limitations)"
