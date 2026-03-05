import { expect, test, describe } from "bun:test";
import { Warichu } from "../../src/js/warichu.ts";

describe("割注クラス（Warichu）の単体テスト", () => {
  
  describe("基本機能: パース処理", () => {
    test("手動分割（｜）が正しく二行に分かれること", () => {
      const w = new Warichu();
      const html = w.parse("〔上段｜下段〕");
      expect(html).toContain("warichu-line1\">上段</span>");
      expect(html).toContain("warichu-line2\">下段</span>");
    });

    test("自動分割: 偶数文字が中央で自然に分かれること", () => {
      const w = new Warichu();
      // 「私は猫です」(6文字) -> 「私は」「猫です」
      const html = w.parse("〔私は猫です〕");
      expect(html).toContain(">私は</span>");
      expect(html).toContain(">猫です</span>");
    });

    test("自動分割: 奇数文字は一行目が一文字多くなること（フォールバック）", () => {
      const w = new Warichu();
      // 「あいうえお」(5文字) -> 「あいう」「えお」
      const html = w.parse("〔あいうえお〕");
      expect(html).toContain(">あいう</span>");
      expect(html).toContain(">えお</span>");
    });

    test("サロゲートペア（𠮷など）を正しく1文字としてカウントすること", () => {
      const w = new Warichu();
      // 「𠮷野家」(3文字) -> 「𠮷野」「家」
      const html = w.parse("〔𠮷野家〕");
      expect(html).toContain(">𠮷野</span>");
      expect(html).toContain(">家</span>");
    });
  });

  describe("オプション設定の検証", () => {
    test("sign: '' の場合に括弧のHTMLタグが出力されないこと", () => {
      const w = new Warichu({ sign: "" });
      const html = w.parse("〔内容〕");
      expect(html).not.toContain("warichu-bracket");
    });

    test("copyable: false の場合にコピー不可の属性が付与されること", () => {
      const w = new Warichu({ copyable: false });
      const html = w.parse("〔内容〕");
      expect(html).toContain('user-select:none;');
      expect(html).toContain('aria-hidden="true"');
    });

    test("align1/2 の指定が style 属性に反映されること", () => {
      const w = new Warichu({ align1: "start", align2: "end" });
      const html = w.parse("〔上｜下〕");
      expect(html).toContain("text-align-last: start;");
      expect(html).toContain("text-align-last: end;");
    });

    test("narrowSign: true の場合に is-narrow クラスが付与されること", () => {
      const w = new Warichu({ narrowSign: true });
      const html = w.parse("〔内容〕");
      expect(html).toContain("is-narrow");
    });
  });
});

