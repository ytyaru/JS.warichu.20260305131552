import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";

// 環境変数からテスト対象のパスを取得
const filePath = process.env.TEST_TARGET!;
const format = process.env.FORMAT!;

describe(`検証対象: ${filePath}`, async () => {
  let WarichuClass: any;

  // 実行形式に合わせてクラスを取得
  if (format === "ems") {
    // ESMは絶対パスで動的インポート
    const absolutePath = resolve(process.cwd(), filePath);
    const mod = await import(absolutePath);
    WarichuClass = mod.Warichu;
  } else {
    // no-esm / script は中身を実行してクラスを抽出
    const code = readFileSync(filePath, "utf-8");
    // global環境を汚さず、ローカルスコープでWarichuを定義させて返す
    const runner = new Function(`
      ${code};
      if (typeof Warichu !== 'undefined') return Warichu;
      if (typeof window !== 'undefined' && window.Warichu) return window.Warichu;
      throw new Error('Warichu class not found in ' + '${filePath}');
    `);
    WarichuClass = runner();
  }

  test("【ロジック】手動分割（｜）が正しく動作すること", () => {
    const w = new WarichuClass();
    const html = w.parse("〔上｜下〕");
    expect(html).toContain("warichu-line1");
    expect(html).toContain("上");
    expect(html).toContain("下");
  });

  test("【ロジック】自動分割が期待通り中央付近で分かれること", () => {
    const w = new WarichuClass();
    // 「私は猫です」(6文字) -> 「私は」「猫です」
    const html = w.parse("〔私は猫です〕");
    expect(html).toContain(">私は</span>");
    expect(html).toContain(">猫です</span>");
  });

  test("【環境】Intl.Segmenter が正常に機能していること", () => {
    const w = new WarichuClass();
    // サロゲートペア（𠮷）のカウントチェック
    const html = w.parse("〔𠮷野家〕");
    expect(html).toContain(">𠮷野</span>");
  });

  test("【ビルド】公開API 'parse' が難読化されずに呼べること", () => {
    const w = new WarichuClass();
    expect(typeof w.parse).toBe("function");
  });
});

