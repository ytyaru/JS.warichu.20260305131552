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

