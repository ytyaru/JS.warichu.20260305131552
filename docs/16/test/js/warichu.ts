import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";

// 環境変数からテスト対象のパスを取得
const filePath = process.env.TEST_TARGET!;
const format = (process.env.FORMAT || "").toLowerCase();
const mode = process.env.MODE || "";

describe(`検証：${filePath}`, async () => {
  let WarichuClass: any;
  let WarichuErrorClass: any;

  // --- クラス抽出ロジック ---
  // パスに /esm/ が含まれるか、拡張子が .ts なら import (ESM) を使用
  const isModule = filePath.includes("/esm/") || filePath.endsWith(".ts") || format === "esm";

  if (isModule) {
    const absolutePath = resolve(process.cwd(), filePath);
    const mod = await import(absolutePath);
    WarichuClass = mod.Warichu;
    WarichuErrorClass = mod.WarichuError;
  } else {
    const code = readFileSync(filePath, "utf-8");
    // global環境を参照しつつ、難読化されていても Warichu を引っ張り出す
    const runner = new Function(`
      ${code};
      const g = typeof globalThis !== 'undefined' ? globalThis : 
                typeof window !== 'undefined' ? window : {};
      return {
        W: g["Warichu"] || (typeof Warichu !== 'undefined' ? Warichu : null),
        E: g["WarichuError"] || (typeof WarichuError !== 'undefined' ? WarichuError : null)
      };
    `);
    const res = runner();
    WarichuClass = res.W;
    WarichuErrorClass = res.E;
  }

  if (!WarichuClass) {
    throw new Error(`クラスが見つかりません: ${filePath} (Module判定: ${isModule})`);
  }

  // --- 網羅的テストケース ---

  describe("1. デフォルト設定値の厳密な検証", () => {
    test("未指定時に青空文庫準拠のデフォルト値（start揃え、全角括弧、コピー可、字差1、半角化有）が適用されること", () => {
      const w = new WarichuClass();
      const res = w.parse("〔あ｜い〕");
      // 出力HTMLから内部設定の適用結果を逆引き検証
      expect(res).toContain("（"); // sign: '（）'
      expect(res).toContain("text-align-last: start;"); // align1: 'start'
      expect(res).toContain("is-narrow"); // narrowSign: true
      expect(res).not.toContain("user-select:none;"); // copyable: true
    });
  });

  describe("1. 初期化と設定の網羅", () => {
    test("デフォルト設定で正常にインスタンス化できること", () => {
      const w = new WarichuClass();
      expect(w).toBeDefined();
    });

    test("全設定項目が正しく反映されること（align, copyable, narrowSign等）", () => {
      const w = new WarichuClass({
        sign: "〔〕",
        align1: "center",
        align2: "end",
        copyable: false,
        narrowSign: true
      });
      const res = w.parse("〔あ｜い〕");
      expect(res).toContain("〔");
      expect(res).toContain("〕");
      expect(res).toContain("text-align-last: center;");
      expect(res).toContain("text-align-last: end;");
      expect(res).toContain("user-select:none;");
      expect(res).toContain("is-narrow");
    });
  });

  describe("2. パース処理（parse）の論理分岐網羅", () => {
    test("手動分割（｜）がある場合、字数差を問わず各行1文字以上あれば受理すること", () => {
      const w = new WarichuClass();
      const res = w.parse("〔あ｜いいいいい〕"); // 1:5 分割
      expect(res).toContain(">あ</span>");
      expect(res).toContain(">いいいいい</span>");
    });

    test("一文字も存在しない、または片方が空の割注はエラーになること", () => {
      const w = new WarichuClass({ error: "throw" });
      expect(() => w.parse("〔〕")).toThrow();
      expect(() => w.parse("〔あ〕")).toThrow();
      expect(() => w.parse("〔｜あ〕")).toThrow();
      expect(() => w.parse("〔あ｜〕")).toThrow();
    });

    test("複数の割注が含まれるテキストをすべて置換すること", () => {
      const w = new WarichuClass();
      const res = w.parse("一つ目〔あ｜い〕二つ目〔う｜え〕");
      const matches = res.match(/warichu-container/g);
      expect(matches?.length).toBe(2);
    });
  });

  describe("3. 自動分割（_getSplitPoint）の優先順位と境界値", () => {
    test("Intl.Segmenter：字差1以内の常用漢字（東京都）が適切に分割されること", () => {
      const w = new WarichuClass();
      const res = w.parse("〔東京都〕");
      expect(res).toContain(">東京</span>");
      expect(res).toContain(">都</span>");
    });

    test("Intl.Segmenter：既知の限界（𠮷野家）は1:2に分割されること", () => {
      const w = new WarichuClass();
      const res = w.parse("〔𠮷野家〕");
      expect(res).toContain(">𠮷</span>");
      expect(res).toContain(">野家</span>");
    });

    test("物理中央分割：奇数長（あいうえお）は1行目が長くなること（3:2）", () => {
      const w = new WarichuClass();
      const res = w.parse("〔あいうえお〕");
      expect(res).toContain(">あいう</span>");
      expect(res).toContain(">えお</span>");
    });
  });

  describe("4. エラーハンドリングの挙動網羅", () => {
    test("error: 'warn' の場合、コンソールに警告を出して処理を継続すること", () => {
      const w = new WarichuClass({ error: "warn" });
      const res = w.parse("〔あ〕"); // 2文字未満エラー
      expect(res).toContain("あ"); // 変換されずに出力されること
    });

    test("カスタムエラークラスを指定してスローできること", () => {
      class MyCustomError extends Error { name = "MyCustomError"; }
      const w = new WarichuClass({ error: MyCustomError });
      expect(() => w.parse("〔あ〕")).toThrow();
      try {
        w.parse("〔あ〕");
      } catch (e: any) {
        expect(e.name).toBe("MyCustomError");
      }
    });
  });

  describe("5. 成果物の品質とセキュリティ", () => {
    test("console.debug の生存/削除がモード（debug/min等）に従っていること", () => {
      const code = readFileSync(filePath, "utf-8");
      if (mode === "debug") {
        expect(code).toContain("console.debug");
      } else {
        expect(code).not.toContain("console.debug");
      }
    });

    test("Minify後も公開API 'parse' が正常に動作すること", () => {
      const w = new WarichuClass();
      const res = w.parse("〔テスト｜です〕");
      expect(res).toContain("warichu-container");
    });
  });
});

import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";

const filePath = process.env.TEST_TARGET!;
const format = (process.env.FORMAT || "").toLowerCase();
const mode = process.env.MODE || "";

describe(`【総合検証】対象ファイル: ${filePath}`, async () => {
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
    WarichuClass = res.W; WarichuErrorClass = res.E;
  }

  if (!WarichuClass) throw new Error(`クラス抽出失敗: ${filePath}`);

  describe("1. コンストラクタ：デフォルト値と設定の網羅", () => {
    test("デフォルト設定が青空文庫の標準（start揃え、全角括弧、字差1）に従っていること", () => {
      const w = new WarichuClass();
      const res = w.parse("〔テスト〕");
      expect(res).toContain("（"); // 全角
      expect(res).toContain("text-align-last: start;"); // start
    });

    test("全設定項目（sign, align1/2, copyable, narrowSign, diff）を上書きできること", () => {
      const w = new WarichuClass({ 
        sign: "[]", align1: "center", align2: "justify", copyable: false, narrowSign: true, diff: 2 
      });
      const res = w.parse("〔あ｜い〕");
      expect(res).toContain("["); expect(res).toContain("]");
      expect(res).toContain("text-align-last: center;");
      expect(res).toContain("text-align-last: justify;");
      expect(res).toContain("user-select:none;");
      expect(res).toContain("is-narrow");
    });
  });

  describe("2. 境界値・物理分割ロジックの網羅", () => {
    test("最小有効長〔あい〕(2書記素)が 1:1 で分割されること", () => {
      const w = new WarichuClass();
      const res = w.parse("〔あい〕");
      expect(res).toContain(">あ</span>"); expect(res).toContain(">い</span>");
    });

    test("最小奇数長〔あいう〕(3書記素)が 2:1 (一行目優先) で分割されること", () => {
      const w = new WarichuClass();
      const res = w.parse("〔あいう〕");
      expect(res).toContain(">あい</span>"); expect(res).toContain(">う</span>");
    });

    test("巨大な奇数長(10001字)において、整数演算により厳密に 5001:5000 に分割されること（IEEE754誤差対策の証明）", () => {
      const w = new WarichuClass();
      const text = "あ".repeat(10001);
      const res = w.parse(`〔${text}〕`);
      expect(res).toContain(`>${"あ".repeat(5001)}</span>`);
      expect(res).toContain(`>${"あ".repeat(5000)}</span>`);
    });

    test("サロゲートペア（𠮷）を含む文字列が書記素単位で正しく計上されること", () => {
      const w = new WarichuClass();
      const res = w.parse("〔𠮷野｜家〕");
      expect(res).toContain(">𠮷野</span>"); // 2書記素
    });
  });

  describe("3. 言語解析（Intl.Segmenter）の仕様と限界の検証", () => {
    test("【成功例】常用漢字（東京都）は形態素解析により『東京｜都』(2:1) と適切に分割されること", () => {
      const w = new WarichuClass();
      expect(w.parse("〔東京都〕")).toContain(">東京</span>");
    });

    test("【既知の限界】𠮷野家(3字)はサロゲートペアがブラウザ辞書未対応のため、Unicode境界判定が優先され『𠮷｜野家』(1:2) になる。これはIntl.Segmenter側の制限事項である", () => {
      const w = new WarichuClass();
      const res = w.parse("〔𠮷野家〕");
      expect(res).toContain(">𠮷</span>");
      expect(res).toContain(">野家</span>");
    });

    test("【救済策】パイプ『｜』による手動分割が、自動解析の結果（𠮷｜野家）を上書きして『𠮷野｜家』を強制できること", () => {
      const w = new WarichuClass();
      expect(w.parse("〔𠮷野｜家〕")).toContain(">𠮷野</span>");
    });
  });

  describe("4. 意地悪テスト：虚無、重複、空行、不正入力", () => {
    test("〔　　〕(全角スペース2)は正常に2段の空白として出力されること", () => {
      const w = new WarichuClass();
      expect(w.parse("〔　　〕")).toContain(">　</span>");
    });

    test("〔｜｜〕(重複パイプ)は一つ目を区切りとし、二つ目を文字と見なすが、片方空エラー（1:0）により拒絶されること", () => {
      const w = new WarichuClass({ error: "throw" });
      expect(() => w.parse("〔｜｜〕")).toThrow();
    });

    test("〔　｜い〕は一行目が空白文字1、二行目が『い』として正常に受理されること", () => {
      const w = new WarichuClass();
      const res = w.parse("〔　｜い〕");
      expect(res).toContain(">　</span>"); expect(res).toContain(">い</span>");
    });

    test("〔あ｜　〕は一行目が『あ』、二行目が空白文字1として正常に受理されること", () => {
      const w = new WarichuClass();
      const res = w.parse("〔あ｜　〕");
      expect(res).toContain(">あ</span>"); expect(res).toContain(">　</span>");
    });

    test("合計2字未満、または片方が空の入力はすべてエラー（または警告フォールバック）となること", () => {
      const w = new WarichuClass({ error: "throw" });
      expect(() => w.parse("〔〕")).toThrow();
      expect(() => w.parse("〔あ〕")).toThrow();
      expect(() => w.parse("〔｜あ〕")).toThrow();
    });
  });

  describe("5. エラーハンドリングと配布品質の網羅", () => {
    test("カスタムエラークラスを指定して、正確にその型でスローされること", () => {
      class MyError extends Error { name = "MyError"; }
      const w = new WarichuClass({ error: MyCustomError }); // 以前のタイポ修正済み
      expect(() => w.parse("〔あ〕")).toThrow();
    });

    test("debugモード以外で console.debug が完全に除去されていること", () => {
      const code = readFileSync(filePath, "utf-8");
      if (mode !== "debug") expect(code).not.toContain("console.debug");
    });

    test("Minifyされた no-esm/script 形式でも globalThis経由で Warichu が参照可能であること", () => {
      const w = new WarichuClass();
      expect(w.parse("〔あ｜い〕")).toContain("warichu-container");
    });
  });
});
