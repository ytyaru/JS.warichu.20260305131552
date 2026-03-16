/**
 * build/build.ts
 * ビルドの実行とファイル出力の制御を行うオーケストレーター
 */
import { build } from "bun";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { Processor } from "./processor";

class Builder {
  private targets = ["bun", "node", "browser"] as const;
  private formats = ["esm", "script"] as const;
  private releases = ["debug", "code", "min"] as const;

  /**
   * ビルドプロセスを開始する
   */
  async run() {
    console.log("22個のファイルをビルド中...");
    await this.buildJs();
    await this.buildTs();
    await this.buildCss();
    console.log("ビルド完了");
  }

  private async buildJs() {
    for (const target of this.targets) {
      for (const format of this.formats) {
        for (const impl of this.implementations) {
          for (const release of this.releases) {
            const isRelease = release === "release";
            const isPerformance = impl === "performance";

            // --- console 削除の設定 (info,warn,error以外の19種類) ---
            const defines: Record<string, string> = {};
            if (isRelease) {
              const drops = [
                "debug", "log", "assert", "clear", "count", "countReset", 
                "dir", "dirxml", "group", "groupCollapsed", "groupEnd", 
                "profile", "profileEnd", "table", "time", "timeEnd", 
                "timeLog", "timeStamp", "trace"
              ];
              for (const d of drops) {
                defines[`console.${d}`] = "undefined";
              }
            }

            const result = await build({
              entrypoints: [src],
              target: target as any,
              format: bunFormat,
              bundle: true,
              minify: isRelease,
              define: defines, // ASTレベルでconsoleを消去
            });

            if (!result.success) {
              console.error(`ビルド失敗: ${target}/${format}/${impl}/${release}`);
              console.error(result.logs);
              process.exit(1);
            }

            let code = await result.outputs[0].text();

            // --- 後加工処理 ---
            // ※ Processor.removeConsole は不要になったため削除
            code = Processor.restoreJa(code);

            const outPath = `dist/js/${target}/${format}/${impl}/${release}.js`;
            writeFileSync(outPath, code);
          }
        }
      }
    }
  }


  /**
   * JSファイルのビルド (18パターン)
   * ターゲット、フォーマット、リリースの組み合わせに応じて最適な形式を選択する
   */
  private async buildJs() {
    for (const target of this.targets) {
      for (const format of this.formats) {
        for (const release of this.releases) {
          const isMin = release === "min";
          const src = isMin ? "src/ts/min/warichu.ts" : "src/ts/code/main.ts";

          // --- 形式の決定ロジック ---
          let bunFormat: "esm" | "cjs" | "iife" = "esm";

          if (format === "script") {
            if (target === "node") {
              // Node.js の非ESMは常に CJS
              bunFormat = "cjs";
            } else if (isMin) {
              // 単一クラスの min.js は ESM から export を消すのが最軽量
              bunFormat = "esm";
            } else {
              // 複数クラスの code/debug は IIFE でカプセル化する
              bunFormat = "iife";
            }
          }

          const result = await build({
            entrypoints: [src],
            target: target as any,
            format: bunFormat,
            bundle: true,
            minify: isMin,
          });

          if (!result.success) {
            console.error(`ビルド失敗: ${target}/${format}/${release}`);
            console.error(result.logs);
            process.exit(1);
          }

          let code = await result.outputs[0].text();

          // --- 後加工処理 ---
          // 1. デバッグ用以外は console を削除
          if (release !== "debug") {
            code = Processor.removeConsole(code);
          }

          // 2. browser/bun の script/min.js のみ、ASTで export を削除
          if (format === "script" && target !== "node" && isMin) {
            code = Processor.removeExport(code);
          }

          // 3. 日本語の復元
          code = Processor.restoreJa(code);

          const outPath = `dist/js/${target}/${format}/${release}.js`;
          writeFileSync(outPath, code);
        }
      }
    }
  }

  /**
   * TSファイルの生成 (バンドル版)
   */
  private async buildTs() {
    const tsResult = await build({
      entrypoints: ["src/ts/code/main.ts"],
      target: "bun",
      format: "esm",
      bundle: true,
      minify: false,
    });
    if (tsResult.success) {
      let code = await tsResult.outputs[0].text();
      writeFileSync("dist/ts/code.ts", Processor.restoreJa(code));
    }
  }

  /**
   * CSSファイルの生成 (ミニファイ版)
   */
  private async buildCss() {
    const cssPath = "src/css/warichu.css";
    if (existsSync(cssPath)) {
      const css = readFileSync(cssPath, "utf-8");
      writeFileSync("dist/css/min.css", Processor.minifyCss(css));
    }
  }
}

new Builder().run();

