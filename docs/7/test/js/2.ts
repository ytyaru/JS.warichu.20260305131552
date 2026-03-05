import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";

// 環境変数からテスト対象のパスを取得
const filePath = process.env.TEST_TARGET!;
const format = process.env.FORMAT!; // ems, no-esm, script

describe(`テスト実行中: ${filePath}`, async () => {
  let WarichuClass: any;

  // 1. ファイルからクラスを抽出（形式に合わせて読み込み方を変える）
  if (format === "ems") {
    // ESM形式は通常のインポート
    const mod = await import(`../../${filePath}`);
    WarichuClass = mod.Warichu;
  } else {
    // no-esm, script形式はグローバル変数を取り出すように実行
    const code = readFileSync(filePath, "utf-8");
    // Warichuクラスを戻り値として返す関数を作成して実行
    const runner = new Function(`${code}; return Warichu;`);
    WarichuClass = runner();
  }

  // 2. 共通の単体テストシナリオ
  test("【仕様】手動分割が正しく動作すること", () => {
    const w = new WarichuClass();
    const html = w.parse("〔上｜下〕");
    expect(html).toContain("warichu-line1");
    expect(html).toContain("上");
  });

  test("【仕様】自動分割がIntl.Segmenterに基づき正常であること", () => {
    const w = new WarichuClass();
    const html = w.parse("〔私は猫です〕");
    expect(html).toContain(">私は</span>");
    expect(html).toContain(">猫です</span>");
  });

  test("【安全性】公開API 'parse' がMinify後も保持されていること", () => {
    const w = new WarichuClass();
    expect(typeof w.parse).toBe("function");
  });
});

