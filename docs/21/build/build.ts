/**
 * build/build.ts
 * ビルドの実行とファイル出力の制御を行うオーケストレーター
 */
import { build } from "bun";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Processor } from "./processor";

// 直積を生成するジェネレータ関数
function* generatePattern<T>(...arrays: T[][]): Generator<T[]> {
    if (arrays.length === 0) {
        yield[];
        return;
    }
    const [first, ...rest] = arrays;
    for (const item of first) {
        for (const combination of generatePattern(...rest)) {
            yield[item, ...combination];
        }
    }
}

class JsBuilder {
    private targets =["bun", "node", "browser"] as const;
    private formats = ["esm", "script"] as const;
    private implementations = ["maintenance", "performance"] as const;
    private bundles = ["within", "without"] as const;
    private complesses = ["debug", "release"] as const;
    
    private drops =[
        "debug", "log", "assert", "clear", "count", "countReset", 
        "dir", "dirxml", "group", "groupCollapsed", "groupEnd", 
        "profile", "profileEnd", "table", "time", "timeEnd", 
        "timeLog", "timeStamp", "trace"
    ] as const;

    async build() {
        // ジェネレータを使用して5重ネストをフラット化
        const patterns = generatePattern(
            this.targets as unknown as string[],
            this.formats as unknown as string[],
            this.implementations as unknown as string[],
            this.bundles as unknown as string[],
            this.complesses as unknown as string[]
        );

        for (const[target, format, impl, bundle, compless] of patterns) {
            const isRelease = compless === 'release';
            const bunFormat = this.getBunFormat(target, format);
            const defines = this.getDefines(isRelease);
            const outDir = `dist/js/${target}/${format}/${impl}/${bundle}/${compless}`;
            
            const srcWarichu = this.getSrc(impl);
            const srcJa = `src/ts/common/ja.ts`; // 共通ライブラリのパス

            if (bundle === "within") {
                // 内包パターン: warichu-ja.js として出力
                await this.executeBuild({
                    entrypoints: [srcWarichu],
                    target: target as any,
                    format: bunFormat as any,
                    bundle: true,
                    minify: isRelease,
                    define: defines,
                }, `${outDir}/warichu-ja.js`);
            } else {
                // 分割パターン: warichu.js と ja.js を出力
                // ※ external に指定することで、warichu.js 内に ja.ts がバンドルされるのを防ぐ
                await this.executeBuild({
                    entrypoints: [srcWarichu],
                    target: target as any,
                    format: bunFormat as any,
                    bundle: true,
                    external:["../common/ja", "./common/ja"], // 実際のimportパスに合わせて調整
                    minify: isRelease,
                    define: defines,
                }, `${outDir}/warichu.js`);

                await this.executeBuild({
                    entrypoints:[srcJa],
                    target: target as any,
                    format: bunFormat as any,
                    bundle: true,
                    minify: isRelease,
                    define: defines,
                }, `${outDir}/ja.js`);
            }
        }
    }

    private getSrc(impl: string): string {
        return `src/ts/${impl}/${impl === 'performance' ? 'warichu' : 'main'}.ts`;
    }

    private getBunFormat(target: string, format: string): string {
        return format === 'script' ? ((target === 'node') ? 'cjs' : 'iife') : 'esm';
    }

    private getDefines(isRelease: boolean): Record<string, string> {
        return isRelease 
            ? this.drops.reduce((o, k) => { o[`console.${k}`] = 'undefined'; return o; }, {} as Record<string, string>) 
            : {};
    }

    private async write(result: any, path: string) {
        let code = await result.outputs[0].text();
        code = Processor.restoreJa(code);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, code);
    }

    async executeBuild(options: any, outPath: string) {
        if (!options.entrypoints.every((p: string) => existsSync(p))) {
            return; // ファイルが存在しない場合はスキップ
        }

        const result = await build(options);
        if (!result.success) {
            console.error(`ビルド失敗: ${outPath}`);
            console.error(result.logs);
            process.exit(1);
        }
        await this.write(result, outPath);
    }
}

class Builder {
    async run() {
        console.log("ビルドを開始します...");
        const B = new JsBuilder();
        await B.build();
        await this.buildTs(B);
        await this.buildCss();
        console.log("ビルド完了");
    }

    /**
     * TSファイルの生成 (dist/ts/ 配下)
     */
    private async buildTs(B: JsBuilder) {
        const impls = ["maintenance", "performance"];
        const bundles = ["within", "without"];

        for (const impl of impls) {
            for (const bundle of bundles) {
                const outDir = `dist/ts/${impl}/${bundle}`;
                const srcWarichu = this.getSrc(impl);
                const srcJa = `src/ts/common/ja.ts`;

                if (bundle === "within") {
                    await B.executeBuild({
                        entrypoints:[srcWarichu],
                        target: "bun",
                        format: "esm",
                        bundle: true,
                        minify: false,
                    }, `${outDir}/warichu-ja.ts`);
                } else {
                    await B.executeBuild({
                        entrypoints: [srcWarichu],
                        target: "bun",
                        format: "esm",
                        bundle: true,
                        external:["../common/ja", "./common/ja"],
                        minify: false,
                    }, `${outDir}/warichu.ts`);

                    await B.executeBuild({
                        entrypoints: [srcJa],
                        target: "bun",
                        format: "esm",
                        bundle: true,
                        minify: false,
                    }, `${outDir}/ja.ts`);
                }
            }
        }
    }

    private getSrc(impl: string): string {
        return `src/ts/${impl}/${impl === 'performance' ? 'warichu' : 'main'}.ts`;
    }

    private async buildCss() {
        const cssPath = "src/css/warichu.css";
        if (existsSync(cssPath)) {
            const css = readFileSync(cssPath, "utf-8");
            mkdirSync("dist/css", { recursive: true });
            writeFileSync("dist/css/min.css", Processor.minifyCss(css));
        }
    }
}

new Builder().run();
