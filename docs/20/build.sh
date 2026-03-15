#!/bin/bash
# build.sh

# 1. dist ディレクトリの初期化
rm -rf dist
mkdir -p dist/ts dist/css

# 2. JS用ディレクトリ構造の作成
for t in bun node browser; do
  for f in esm script; do
    mkdir -p "dist/js/$t/$f"
  done
done

# 3. 加工不要なファイルのコピー
cp src/ts/min/warichu.ts dist/ts/min.ts
cp src/css/warichu.css dist/css/code.css

# 4. ビルドプロセスの実行
bun build/build.ts

echo "ビルド完了"

