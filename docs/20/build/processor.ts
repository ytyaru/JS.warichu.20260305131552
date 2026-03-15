/**
 * build/processor.ts
 */
export class Processor {
  /** Unicodeエスケープされた日本語を元の文字に戻す */
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

  /** ESMのexport構文を削除し、Classic Script形式にする */
  static removeExport(code: string): string {
    return code
      .replace(/^export\s+(class|const|let|var|function|type|interface)\s+/gm, "$1 ")
      .replace(/\nexport\s*\{[\s\S]*?\};?\s*$/g, "");
  }

  /** info,warn,error以外19種類のconsoleはすべて削除する */
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

  /** CSSを簡易的にミニファイする */
  static minifyCss(css: string): string {
    return css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\s+/g, " ")
      .replace(/\s*([\{\}\:\;\,])\s*/g, "$1")
      .trim();
  }
}

