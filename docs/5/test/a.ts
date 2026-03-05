import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";

// 環境変数からテスト対象のパスを取得
const filePath = process.env.TARGET_FILE || "";
const mode = process.env.MODE || "";

if (!filePath) {
  throw new Error("TARGET_FILE is not defined");
}

describe(`Testing ${filePath}`, async () => {
  // 動的インポート
  const { Warichu } = await import(`../../../../${filePath}`);

  test("ロジックの完全性: 割注が正しくHTML化されるか", () => {
    const w = new Warichu({ sign: "()" });
    const res = w.parse("〔上｜下〕");
    expect(res).toContain("warichu-line1");
    expect(res).toContain("上");
    expect(res).toContain("下");
    expect(res).toContain("(");
  });

  test("自動分割ロジック: 書記素と単語区切りの検証", () => {
    const w = new Warichu();
    // 「私は猫です」(6文字) -> 「私は」「猫です」で分割されるか
    const res = w.parse("〔私は猫です〕");
    expect(res).toContain(">私は</span>");
    expect(res).toContain(">猫です</span>");
  });

  test("consoleの生存/削除チェック", () => {
    const content = readFileSync(filePath, "utf-8");
    
    if (mode === "debug") {
      // debugモードはconsole.debugが残っているべき
      expect(content).toContain("console.debug");
    } else {
      // code, minモードはconsole.debugが消えているべき
      expect(content).not.toContain("console.debug");
      // かつ、errorやwarnは残っていても良い（削除対象外）
      // ※ソースコードにconsole.errorがあれば、ここを通る
    }
  });

  test("Minifyによる構文破壊がないか", () => {
    // 実際にクラスをインスタンス化してメソッドが呼べれば、構文は壊れていない
    const w = new Warichu({ sign: "" });
    expect(() => w.parse("〔test〕")).not.toThrow();
  });
});

