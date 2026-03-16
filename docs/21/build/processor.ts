/**
 * build/processor.ts
 * ビルドプロセスにおけるソースコードの加工ロジックを集約したクラス
 */
import { Transpiler } from "bun";

/**
 * ソースコードおよびアセットの変換処理を行うユーティリティクラス
 */
export class Processor {
  /**
   * Unicodeエスケープされた日本語文字列を元の文字（UTF-8）に復元する。
   * 句読点、かな、漢字、全角記号などの日本語セーフレンジのみを対象とし、
   * 制御文字や特殊記号のエスケープは維持することで安全性を確保する。
   * 
   * @param code 加工対象のソースコード文字列
   * @returns 日本語が復元されたソースコード文字列
   */
  static restoreJa(code: string): string {
    return code.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => {
      const c = parseInt(h, 16);
      const isJapanese =
        (c >= 0x3000 && c <= 0x30FF) || // 句読点・かな
        (c >= 0x4E00 && c <= 0x9FFF) || // 常用漢字
        (c >= 0xFF00 && c <= 0xFFEF) || // 全角英数・記号
        (c >= 0x3400 && c <= 0x4DBF);   // 漢字拡張
      return isJapanese ? String.fromCharCode(c) : `\\u${h}`;
    });
  }

  /**
   * Bun.Transpiler を使用して ESM の export 構文を削除し、Classic Script 形式に変換する。
   * 内部で一度 CJS 形式に変換することで export キーワードを排除し、
   * その後、ブラウザ環境で不要となる exports オブジェクトへの代入処理を除去する。
   * 
   * @param code 加工対象のソースコード文字列
   * @returns export 構文が除去されたソースコード文字列
   */
   /*
  static removeExport(code: string): string {
    const transpiler = new Transpiler({ loader: "ts" });
    
    // 1. CJS形式に変換して export キーワードを exports への代入文に置き換える
    const cjs = transpiler.transformSync(code, "cjs");

    // 2. exports への代入およびモジュール定義コードを削除する
    // ※ Object.defineProperty の削除は第一引数が exports の場合に限定し、
    //    ユーザーコード内のクラス名定義（CustomError等）を破壊しないようにする
    return cjs
      .replace(/Object\.defineProperty\(exports,\s*["']__esModule["'],\s*\{[^}]+\}\);?/g, "")
      .replace(/exports\.[a-zA-Z0-9_$]+\s*=\s*[^;]+;?/g, "")
      .replace(/module\.exports\s*=\s*[^;]+;?/g, "")
      .trim();
  }
  */
  /**
   * export構文を削除する。
   * ESMからexport文を削除してClassic Script用コードにするために。
   * 【警告：コード破壊の恐れ】
   * ソースコードを文字列として扱い、正規表現による置換で export 構文を強制的に削除する。
   * 構文解析を行わないため、コードの構造によっては意図しない箇所を破壊するリスクがある。
   * 
   * @param code 加工対象のソースコード文字列
   * @returns export 構文が除去されたソースコード文字列
   */ 
  static removeExport(code: string): string {
    // ESM形式の末尾にある export { ... } ブロックを文字列置換で削除する
    // $ アンカーにより、ファイル末尾の記述のみを対象とする
    return code.replace(/export\s*\{[\s\S]*?\};?\s*$/, "").trim();
  }
  /**
   * ソースコードから指定された console メソッドの呼び出しを削除する。
   * info, warn, error を除く、デバッグ用の 19 種類のメソッドを対象とする。
   * 
   * @param code 加工対象のソースコード文字列
   * @returns console 呼び出しが削除されたソースコード文字列
   */
  static removeConsole(code: string): string {
    const drops = [
      "debug", "log", "assert", "clear", "count", "countReset", 
      "dir", "dirxml", "group", "groupCollapsed", "groupEnd", 
      "profile", "profileEnd", "table", "time", "timeEnd", 
      "timeLog", "timeStamp", "trace"
    ];
    const pattern = new RegExp(`console\\.(${drops.join("|")})\\s*\\([^)]*\\);?`, "g");
    return code.replace(pattern, "");
  }

  /**
   * CSS ソースコードを簡易的にミニファイする。
   * コメントの削除、改行の除去、および記号周りの不要な空白の集約を行う。
   * 
   * @param css 加工対象の CSS 文字列
   * @returns ミニファイされた CSS 文字列
   */
  static minifyCss(css: string): string {
    return css
      .replace(/\/\*[\s\S]*?\*\//g, "")       // コメント削除
      .replace(/\s+/g, " ")                   // 空白集約
      .replace(/\s*([\{\}\:\;\,])\s*/g, "$1") // 記号周りの空白削除
      .trim();
  }
}

