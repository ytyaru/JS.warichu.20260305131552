#!/bin/bash

echo "Starting Dist Tests..."

# 各モードの代表的なテストを実行
# test/js/内のTSファイルにパスを引数で渡して実行
echo "[1/3] Testing: dist/js/bun/ems/debug.js"
export TARGET_FILE="dist/js/bun/ems/debug.js"
export MODE="debug"
bun test test/js/bun/ems/logic.test.ts

echo "[2/3] Testing: dist/js/bun/ems/code.js"
export TARGET_FILE="dist/js/bun/ems/code.js"
export MODE="code"
bun test test/js/bun/ems/logic.test.ts

echo "[3/3] Testing: dist/js/bun/ems/min.js"
export TARGET_FILE="dist/js/bun/ems/min.js"
export MODE="min"
bun test test/js/bun/ems/logic.test.ts

echo "All sample tests passed."

