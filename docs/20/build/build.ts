/**
 * build/build.ts
 */
import { build } from "bun";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { Processor } from "./processor";

class Builder {
  private targets = ["bun", "node", "browser"] as const;
  private formats = ["esm", "script"] as const;
  private releases = ["debug", "code", "min"] as const;

  async run() {
    console.log("Building 22 files...");
    await this.buildJs();
    await this.buildTs();
    await this.buildCss();
    console.log("Build complete.");
  }

  /** JSファイルのビルド (18パターン) */
  private async buildJs() {
    for (const target of this.targets) {
      for (const format of this.formats) {
        for (const release of this.releases) {
          const isMin = release === "min";
          const src = isMin ? "src/ts/min/warichu.ts" : "src/ts/code/main.ts";

          const result = await build({
            entrypoints: [src],
            target: target as any,
            format: "esm",
            bundle: true,
            minify: isMin,
          });

          if (!result.success) {
            console.error(result.logs);
            process.exit(1);
          }

          let code = await result.outputs[0].text();

          if (release !== "debug") code = Processor.removeConsole(code);
          if (format === "script") code = Processor.removeExport(code);
          code = Processor.restoreJa(code);

          const outPath = `dist/js/${target}/${format}/${release}.js`;
          writeFileSync(outPath, code);
        }
      }
    }
  }

  /** TSファイルの生成 (バンドル版) */
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

  /** CSSファイルの生成 (ミニファイ版) */
  private async buildCss() {
    const css = readFileSync("src/css/warichu.css", "utf-8");
    writeFileSync("dist/css/min.css", Processor.minifyCss(css));
  }
}

new Builder().run();
