import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";

const filePath = process.env.TEST_TARGET!;
const format = (process.env.FORMAT || "").toLowerCase();
const mode = process.env.MODE || "";

describe(`【最終網羅検証】対象: ${filePath}`, async () => {
  let WarichuClass: any;
  let WarichuErrorClass: any;

  // --- クラス抽出ロジック（ESM/non-ESM、難読化対応） ---
  const isModule = filePath.includes("/esm/") || filePath.endsWith(".ts") || format === "esm";
  if (isModule) {
    const absolutePath = resolve(process.cwd(), filePath);
    const mod = await import(absolutePath);
    WarichuClass = mod.Warichu; 
    WarichuErrorClass = mod.WarichuError;
  } else {
    const code = readFileSync(filePath, "utf-8");
    const runner = new Function(`${code}; const g = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {}; return { W: g["Warichu"] || (typeof Warichu !== 'undefined' ? Warichu : null), E: g["WarichuError"] || (typeof WarichuError !== 'undefined' ? WarichuError : null) };`);
    const res = runner();
    WarichuClass = res.W; 
    WarichuErrorClass = res.E;
  }

  if (!WarichuClass) throw new Error(`クラス抽出失敗: ${filePath}`);

  describe("1. コンストラクタ：デフォルト値の厳密な論理性検証", () => {
    test("未指定時に『青空文庫準拠』のデフォルト値（start揃え、全角括弧、コピー可、字差1、半角化有）が適用されていること", () => {
      const w = new WarichuClass();
      const res = w.parse("〔あいうえお〕");
      expect(res).toContain("（"); // sign: '（）'
      expect(res).toContain("text-align-last: start;"); // align: 'start'
      expect(res).toContain("is-narrow"); // narrowSign: true
      expect(res).not.toContain("user-select:none;"); // copyable: true
      // 5文字が 3:2 分割されることで diff:1 の適用を証明
      expect(res).toContain(">あいう</span>");
      expect(res).toContain(">えお</span>");
    });
  });

  describe("2. 境界値・物理分割と巨大データ（10001字）誤差回避テスト", () => {
    test("最小有効長〔あい〕(2字)が 1:1 で分割されること", () => {
      const w = new WarichuClass();
      const res = w.parse("〔あい〕");
      expect(res).toContain(">あ</span>");
      expect(res).toContain(">い</span>");
    });

    test("最小奇数長〔あいう〕(3字)が 2:1（一行目優先）で分割されること", () => {
      const w = new WarichuClass();
      const res = w.parse("〔あいう〕");
      expect(res).toContain(">あい</span>");
      expect(res).toContain(">う</span>");
    });

    test("巨大な奇数長(10001字)において、IEEE754の浮動小数点誤差に負けず、整数演算によって厳密に 5001:5000 で分割されることの証明", () => {
      const w = new WarichuClass();
      const text = "あ".repeat(10001);
      const res = w.parse(`〔${text}〕`);
      expect(res).toContain(`>${"あ".repeat(5001)}</span>`);
      expect(res).toContain(`>${"あ".repeat(5000)}</span>`);
    });
  });

  describe("3. 言語解析（Intl.Segmenter）の仕様と既知の限界説明", () => {
    test("【解析成功】常用漢字（東京都）は辞書により『東京｜都』(2:1) と適切に分割されること", () => {
      const w = new WarichuClass();
      const res = w.parse("〔東京都〕");
      expect(res).toContain(">東京</span>");
      expect(res).toContain(">都</span>");
    });

    test("【既知の限界】𠮷野家(3字)はサロゲートペア『𠮷』がブラウザ辞書未対応のため、Unicode境界判定（未知の語の切り出し）が優先され『𠮷｜野家』(1:2) になる。これはIntl.Segmenter側の辞書不備による現在の制限事項である", () => {
      const w = new WarichuClass();
      const res = w.parse("〔𠮷野家〕");
      expect(res).toContain(">𠮷</span>");
      expect(res).toContain(">野家</span>");
    });

    test("【救済策】パイプ『｜』による手動分割は、自動解析（𠮷｜野家）の結果を上書きし、字数差を問わずユーザーの意図（𠮷野｜家）を強制できること", () => {
      const w = new WarichuClass();
      const res = w.parse("〔𠮷野｜家〕");
      expect(res).toContain(">𠮷野</span>");
      expect(res).toContain(">家</span>");
    });
  });

  describe("4. 意地悪テスト：虚無、空白、不正なパイプ、例外メッセージ", () => {
    const msgLineEmpty = "割注の片方の行が空です。";
    const msgMinLen = "割注は合計2文字以上必要です";
    const msgMultiPipe = "パイプ「｜」が複数含まれています";

    test("〔　　〕(全角スペース2字)が正常に出力されること", () => {
      expect(new WarichuClass().parse("〔　　〕")).toContain(">　</span>");
    });

    test("〔　｜い〕および〔あ｜　〕のように、空白が含まれていても各行に一字以上あれば受理されること", () => {
      const w = new WarichuClass();
      const res1 = w.parse("〔　｜い〕");
      expect(res1).toContain(">　</span>");
      expect(res1).toContain(">い</span>");
      const res2 = w.parse("〔あ｜　〕");
      expect(res2).toContain(">あ</span>");
      expect(res2).toContain(">　</span>");
    });

    test("不正なパイプ：〔｜〕, 〔あ｜〕, 〔｜い〕が正確なメッセージで拒絶されること", () => {
      const w = new WarichuClass({ error: "throw" });
      expect(() => w.parse("〔｜〕")).toThrow(msgMinLen);
      expect(() => w.parse("〔あ｜〕")).toThrow(msgLineEmpty);
      expect(() => w.parse("〔｜い〕")).toThrow(msgLineEmpty);
    });

    test("重複パイプ：〔｜｜〕, 〔｜｜｜〕, 〔あ｜｜い〕, 〔あ｜い｜う〕が正確なメッセージで例外となること", () => {
      const w = new WarichuClass({ error: "throw" });
      expect(() => w.parse("〔｜｜〕")).toThrow(msgMultiPipe);
      expect(() => w.parse("〔｜｜｜〕")).toThrow(msgMultiPipe);
      expect(() => w.parse("〔あ｜｜い〕")).toThrow(msgMultiPipe);
      expect(() => w.parse("〔あ｜い｜う〕")).toThrow(msgMultiPipe);
    });

    test("合計2字未満：〔〕および〔あ〕が例外となること", () => {
      const w = new WarichuClass({ error: "throw" });
      expect(() => w.parse("〔〕")).toThrow(msgMinLen);
      expect(() => w.parse("〔あ〕")).toThrow(msgMinLen);
    });
  });

  describe("5. 混在テキストおよび複数割注の検証", () => {
    test("通常のテキストと割注が混在し、複数の割注がすべて正しく置換されること", () => {
      const w = new WarichuClass();
      const input = "前文〔あ｜い〕中分〔う｜え〕後文";
      const res = w.parse(input);
      expect(res).toMatch(/^前文<span class="warichu-container">.*中分<span class="warichu-container">.*後文$/);
      const containers = res.match(/warichu-container/g);
      expect(containers?.length).toBe(2);
    });
  });

  describe("6. 配布品質・カスタムエラー・Minify耐性", () => {
    test("カスタムエラークラスを指定して、型とメッセージが一致した例外がスローされること", () => {
      class MyCustomError extends Error { name = "MyCustomError"; }
      const w = new WarichuClass({ error: MyCustomError });
      try {
        w.parse("〔あ〕");
      } catch (e: any) {
        expect(e instanceof MyCustomError).toBe(true);
        expect(e.message).toContain("2文字以上必要");
      }
    });

    test("mode: min において console.debug が物理的に除去されていること", () => {
      if (mode === "min") {
        const code = readFileSync(filePath, "utf-8");
        expect(code).not.toContain("console.debug");
      }
    });

    test("難読化された min.js でも globalThis['Warichu'] 経由で正常に機能すること", () => {
      const w = new WarichuClass();
      expect(w.parse("〔あ｜い〕")).toContain("warichu-container");
    });
  });
});
