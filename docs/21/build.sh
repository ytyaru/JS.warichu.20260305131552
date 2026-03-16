#!/bin/bash
# build.sh

# 1. dist ディレクトリの初期化
rm -rf dist
mkdir -p dist/ts dist/css

# 2. JS用ディレクトリ構造の作成 (3 targets * 2 formats * 2 implementations)
for t in bun node browser; do
  for f in esm script; do
    for i in maintenance performance; do
      mkdir -p "dist/js/$t/$f/$i"
    done
  done
done

# 3. 加工不要なファイルのコピー
# ※ src/ts/performance/warichu.ts は単体で完結しているためそのまま配布用TSとしても利用
cp src/ts/performance/warichu.ts dist/ts/performance.ts
cp src/css/warichu.css dist/css/maintenance.css

# 4. ビルドプロセスの実行
bun build/build.ts || exit 1

echo "ビルド完了"
