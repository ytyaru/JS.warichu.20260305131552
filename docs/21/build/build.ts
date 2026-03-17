/**
 * build/build.ts
 * ビルドの実行とファイル出力の制御を行うオーケストレーター
 */
import { build } from "bun";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { Processor } from "./processor";

class JsBuilder {
    private targets = ["bun", "node", "browser"] as const;
    private formats = ["esm", "script"] as const;
    private implementations = ["maintenance", "performance"] as const;
    private releases = ["debug", "release"] as const;
    private drops = [
        "debug", "log", "assert", "clear", "count", "countReset", 
        "dir", "dirxml", "group", "groupCollapsed", "groupEnd", 
        "profile", "profileEnd", "table", "time", "timeEnd", 
        "timeLog", "timeStamp", "trace"] as const;
    async build() {
        for (const target of this.targets) {
            for (const format of this.formats) {
                for (const impl of this.implementations) {
                    for (const release of this.releases) {
                        const isRelease = release === 'release';
                        const src = this.getSrc(impl);
                        const bunFormat = this.getBunFormat(target, format);
                        const defines = this.getDefines(isRelease);
                        await this.buildJs({
                            entrypoints: [src],
                            target: target as any,
                            format: bunFormat,
                            bundle: true,
                            minify: isRelease,
                            define: defines, // ASTレベルでconsoleを消去
                        }, `dist/js/${target}/${format}/${impl}/${release}.js`);
                    }
                }
            }
        }
    }
    private getSrc(impl:string):string {return `src/ts/${impl}/${impl==='performance' ? 'warichu' : 'main'}.ts`}
    private getBunFormat(target:string, format:string):string {return format === 'script' ? ((target === 'node') ? 'cjs' : 'iife') : 'esm';}
    private getDefines(isRelease): Record<string, string> {
        return isRelease ? drops.reduce((o,k)=>o[`console.${k}`]='undefined',({})) : ({});
    }
    private write(result, path) {
        let code = await result.outputs[0].text();
        code = Processor.restoreJa(code); // \u0000形式を文字に復元する（bunのbuildを実行するとこうなるので）
        writeFileSync(path, code);
    }
    async buildJs(options, outPath) {
        const result = await build(options);
        if (!result.success) {
            console.error(`ビルド失敗: ${outPath}`);
            console.error(result.logs);
            process.exit(1);
        }
        this.write(result, outPath);
    }
}
class Builder {
  private targets = ["bun", "node", "browser"] as const;
  private formats = ["esm", "script"] as const;
  private implementations = ["maintenance", "performance"] as const;
  private releases = ["debug", "release"] as const;

  /**
   * ビルドプロセスを開始する
   */
  async run() {
    console.log("22個のファイルをビルド中...");
    const B = new JsBuilder();
    await B.build();
    await this.buildTs(B);
    await this.buildCss();
//    await this.buildJs();
//    await this.buildTs();
//    await this.buildCss();
    console.log("ビルド完了");
  }
  /**
   * TSファイルの生成 (バンドル版)
   */
  private async buildTs(B) {
    await B.biuldJs({
      entrypoints: ["src/ts/maintenance/main.ts"],
      target: "bun",
      format: "esm",
      bundle: true,
      minify: false,
    }, 'dist/ts/maintenance.ts');
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

