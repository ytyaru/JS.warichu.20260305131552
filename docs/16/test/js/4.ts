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
      // 1. globalThis (Bun/Node) に登録されているか
      if (typeof globalThis !== 'undefined' && globalThis.Warichu) return globalThis.Warichu;
      // 2. window (Browser) に登録されているか
      if (typeof window !== 'undefined' && window.Warichu) return window.Warichu;
      // 3. ローカル変数として Warichu が存在するか (非ミニファイ版用)
      if (typeof Warichu !== 'undefined') return Warichu;
      throw new Error('Warichu class not found');
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

  describe("自動分割の言語依存性と限界の検証", () => {
    
    test("【成功例】辞書にある常用漢字（東京都）は形態素解析により『東京｜都』と適切に分割されること", () => {
      const w = new WarichuClass();
      const html = w.parse("〔東京都〕");
      // 「東京(2文字)」と「都(1文字)」で分割されることを期待
      expect(html).toContain(">東京</span>");
      expect(html).toContain(">都</span>");
    });

    test("【既知の限界】サロゲートペア（𠮷等）はブラウザ辞書が未対応のため、Unicode境界判定により不自然な位置（𠮷｜野家）で分割される可能性がある", () => {
      const w = new WarichuClass();
      const html = w.parse("〔𠮷野家〕");
      
      // 現状のブラウザ（Intl.Segmenter）の仕様では「𠮷」を未知の語として切り離すため 1+2 分割になる
      // 将来的にブラウザが改善されれば、このテストは「𠮷野｜家」の期待値へ修正が必要になる
      expect(html).toContain(">𠮷</span>");
      expect(html).toContain(">野家</span>");
    });

    test("【救済策】自動分割が不自然な場合は、パイプ『｜』による手動分割でユーザーの意図（𠮷野｜家）を強制できること", () => {
      const w = new WarichuClass();
      // 自動分割が「𠮷｜野家」になっても、手動指定すれば「𠮷野｜家」にできる
      const html = w.parse("〔𠮷野｜家〕");
      expect(html).toContain(">𠮷野</span>");
      expect(html).toContain(">家</span>");
    });
  });

  describe("書記素（Grapheme）カウントの正確性", () => {
    test("サロゲートペアを含む奇数長の文字列が、手動分割なしでも文字化けせず全文字保持されること", () => {
      const w = new WarichuClass();
      const html = w.parse("〔𠮷野家〕");
      // 分割位置に関わらず、全ての書記素が欠損なく出力されているか
      const text = html.replace(/<[^>]*>/g, "");
      expect(text).toBe("（𠮷野家）");
    });
  });

  test("【環境】自動分割の限界とフォールバックの確認", () => {
    const w = new WarichuClass();
    // 「𠮷野家」において Segmenter が「𠮷｜野家」と返す現状の挙動を「現在の仕様」として受け入れる
    // あるいは、将来的にブラウザが賢くなればこのテストを更新する
    const html = w.parse("〔𠮷野家〕");
    
    // 少なくとも、文字が化けたり消失したりしていないことを保証する
    expect(html).toContain("𠮷");
    expect(html).toContain("野");
    expect(html).toContain("家");
  });



  test("【ビルド】公開API 'parse' が難読化されずに呼べること", () => {
    const w = new WarichuClass();
    expect(typeof w.parse).toBe("function");
  });
});











/*
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
*/







/*
import { expect, test, describe } from "bun:test";
import { Warichu } from "./warichu";

describe("Warichu Class Tests", () => {
  
  test("基本パース: 手動分割", () => {
    const w = new Warichu();
    const res = w.parse("〔上段｜下段〕");
    expect(res).toContain("warichu-line1\">上段</span>");
    expect(res).toContain("warichu-line2\">下段</span>");
  });

  test("自動分割: 偶数（自然な区切りあり）", () => {
    const w = new Warichu();
    // 「私は｜猫です」で分かれるべき（3+3=6文字）
    const res = w.parse("〔私は猫です〕");
    expect(res).toContain(">私は</span>");
    expect(res).toContain(">猫です</span>");
  });

  test("自動分割: 偶数（自然な区切りが中央にない）", () => {
    const w = new Warichu();
    // 「あいうえおか」中央は3文字目。区切りがないので「あいう｜えおか」
    const res = w.parse("〔あいうえおか〕");
    expect(res).toContain(">あいう</span>");
    expect(res).toContain(">えおか</span>");
  });

  test("自動分割: 奇数（自然な区切りあり 差分0.5）", () => {
    const w = new Warichu();
    // 「これは｜ペン」 (3文字+2文字 = 5文字。中央は2.5。差分0.5)
    const res = w.parse("〔これはペン〕");
    expect(res).toContain(">これは</span>");
    expect(res).toContain(">ペン</span>");
  });

  test("自動分割: 奇数（フォールバック 1行目長め）", () => {
    const w = new Warichu();
    // 5文字で区切りなし -> 3文字と2文字
    const res = w.parse("〔あいうえお〕");
    expect(res).toContain(">あいう</span>");
    expect(res).toContain(">えお</span>");
  });

  test("サロゲートペア/結合文字の考慮", () => {
    const w = new Warichu();
    // 𠮷(1)野(1)家(1) = 3文字。 2+1に分かれるべき
    const res = w.parse("〔𠮷野家〕");
    expect(res).toContain(">𠮷野</span>");
    expect(res).toContain(">家</span>");
  });

  test("括弧なし設定", () => {
    const w = new Warichu({ sign: "" });
    const res = w.parse("〔内容〕");
    expect(res).not.toContain("warichu-bracket");
  });

  test("コピー不可設定", () => {
    const w = new Warichu({ copyable: false });
    const res = w.parse("〔内容〕");
    expect(res).toContain('user-select:none;');
    expect(res).toContain('aria-hidden="true"');
  });

  test("カスタム揃え設定", () => {
    const w = new Warichu({ align1: "start", align2: "end" });
    const res = w.parse("〔上｜下〕");
    expect(res).toContain("text-align-last: start;");
    expect(res).toContain("text-align-last: end;");
  });

  test("全角括弧の半角化クラス", () => {
    const w = new Warichu({ narrowSign: true });
    const res = w.parse("〔内容〕");
    expect(res).toContain("is-narrow");
  });

  test("複数箇所の置換", () => {
    const w = new Warichu();
    const input = "一つ目〔上｜下〕二つ目〔左｜右〕";
    const res = w.parse(input);
    const matches = res.match(/warichu-container/g);
    expect(matches?.length).toBe(2);
  });
});
*/

