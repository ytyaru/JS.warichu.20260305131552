// src/ts/code/utils/error-class.ts
class ErrorClass {
  static make(...definitions) {
    return this.makeObj(...definitions);
  }
  static makeObj(...definitions) {
    const result = {};
    const names = definitions.map((d) => d.split(" ")[0]);
    if (new Set(names).size !== names.length) {
      throw new Error("ErrorClass.makeObj: クラス名が重複しています。");
    }
    for (const def of definitions) {
      const cls = this.makeCls(def);
      result[cls.name] = cls;
    }
    return result;
  }
  static makeAry(...definitions) {
    return definitions.map((def) => this.makeCls(def));
  }
  static makeCls(definition) {
    if (typeof definition !== "string") {
      throw new TypeError("ErrorClass.makeCls: 定義は文字列である必要があります。");
    }
    const [name, parentName = "Error"] = definition.trim().split(/\s+/);
    if (!name || /^[0-9]/.test(name) || /[^a-zA-Z0-9_$]/.test(name)) {
      throw new Error(`ErrorClass.makeCls: 不正なクラス名です: "${name}"`);
    }
    const Parent = (typeof globalThis !== "undefined" ? globalThis[parentName] : null) || Error;
    const CustomError = class extends Parent {
      constructor(message, cause) {
        super(message, cause ? { cause } : undefined);
        this.name = name;
      }
    };
    Object.defineProperty(CustomError, "name", { value: name, configurable: true });
    return CustomError;
  }
  static regist(...definitions) {
    const obj = this.makeObj(...definitions);
    if (typeof globalThis !== "undefined") {
      for (const name in obj) {
        globalThis[name] = obj[name];
      }
    }
    if (typeof window !== "undefined") {
      for (const name in obj) {
        window[name] = obj[name];
      }
    }
  }
}

// src/ts/code/types.ts
var { WarichuError } = ErrorClass.make("WarichuError");
var ALLOWED_PAIRS = {
  "(": ")",
  "[": "]",
  "{": "}",
  "<": ">",
  "（": "）",
  "［": "］",
  "｛": "｝",
  "＜": "＞",
  "〔": "〕",
  "〘": "〙",
  "〚": "〛",
  "【": "】",
  "〖": "〗",
  "『": "』",
  "「": "」",
  "〈": "〉",
  "《": "》",
  "“": "”",
  "‘": "’",
  "«": "»"
};
var defaultOptions = {
  syntax: {
    enclosers: { open: "〔", close: "〕" },
    separator: "｜"
  },
  brackets: {
    chars: ["(", ")"],
    copyable: true,
    narrow: false
  },
  split: {
    diff: 1,
    priority: 1
  },
  align: {
    start: "start",
    end: "start"
  }
};

// src/ts/code/utils/get-segments.ts
function getSegments(text, granularity = "grapheme", lang = "ja") {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(lang, { granularity });
    return Array.from(segmenter.segment(text)).map((s) => s.segment);
  }
  return granularity === "grapheme" ? Array.from(text) : [];
}

// src/ts/code/normalize.ts
function normalize(userOptions = {}) {
  return {
    syntax: normalizeSyntax(userOptions.syntax),
    brackets: normalizeBrackets(userOptions.brackets),
    split: { ...defaultOptions.split, ...userOptions.split },
    align: { ...defaultOptions.align, ...userOptions.align }
  };
}
function normalizeSyntax(userSyntax) {
  if (!userSyntax) {
    return { ...defaultOptions.syntax };
  }
  return {
    enclosers: normalizeEnclosers(userSyntax.enclosers),
    separator: userSyntax.separator ?? defaultOptions.syntax.separator
  };
}
function normalizeEnclosers(raw) {
  if (raw === undefined) {
    return { ...defaultOptions.syntax.enclosers };
  }
  if (typeof raw === "string") {
    const chars = getSegments(raw);
    return {
      open: chars[0] ?? "",
      close: chars[1] ?? ""
    };
  }
  if (Array.isArray(raw)) {
    return {
      open: raw[0] ?? "",
      close: raw[1] ?? ""
    };
  }
  return {
    open: raw.open ?? "",
    close: raw.close ?? ""
  };
}
function normalizeBrackets(userBrackets) {
  if (!userBrackets) {
    return { ...defaultOptions.brackets };
  }
  return {
    chars: normalizeChars(userBrackets.chars),
    copyable: userBrackets.copyable ?? defaultOptions.brackets.copyable,
    narrow: userBrackets.narrow ?? defaultOptions.brackets.narrow
  };
}
function normalizeChars(raw) {
  if (raw === undefined) {
    return [...defaultOptions.brackets.chars];
  }
  let chars;
  if (typeof raw === "string") {
    chars = getSegments(raw);
  } else {
    chars = raw;
  }
  return chars.length === 0 ? ["", ""] : chars;
}

// src/ts/code/validate.ts
var createError = (type, key, expected, actual) => {
  return new WarichuError(`${type}が不正です。対象キー: options.${key} 期待値: ${expected} 実際値: ${actual}`);
};
var assertValid = (key, value, expectedType, condition, expectedValueMsg) => {
  if (typeof value !== expectedType) {
    throw createError("型", key, expectedType, typeof value);
  }
  if (condition !== undefined && !condition) {
    throw createError("値", key, expectedValueMsg, String(value));
  }
};
function validate(options) {
  validateSyntax(options.syntax);
  validateBrackets(options.brackets);
  validateSplit(options.split);
  validateAlign(options.align);
}
function validateSyntax(syntax) {
  const { open, close } = syntax.enclosers;
  const { separator } = syntax;
  if (!ALLOWED_PAIRS[open] || ALLOWED_PAIRS[open] !== close) {
    const allowed = Object.keys(ALLOWED_PAIRS).map((k) => `${k}${ALLOWED_PAIRS[k]}`).join(", ");
    throw createError("値", "syntax.enclosers", `許可されているペア(${allowed})`, `${open}${close}`);
  }
  const sepLen = getSegments(separator).length;
  assertValid("syntax.separator", separator, "string", sepLen === 1, "1文字（書記素）");
  if (separator === open || separator === close) {
    throw new WarichuError(`options.syntax.separator は enclosers と異なる文字である必要があります: ${separator}`);
  }
  const hasControl = (s) => /[\p{C}]/u.test(s);
  if (hasControl(open) || hasControl(close) || hasControl(separator)) {
    throw new WarichuError("options.syntax に制御文字を含めることはできません。");
  }
}
function validateBrackets(brackets) {
  const [c0, c1] = brackets.chars.map((c) => getSegments(c).length);
  const totalLen = c0 + c1;
  assertValid("brackets.chars", brackets.chars, "object", c0 === c1 && (totalLen === 0 || totalLen === 2), "両方とも空文字、または両方とも1文字");
  assertValid("brackets.copyable", brackets.copyable, "boolean");
  assertValid("brackets.narrow", brackets.narrow, "boolean");
}
function validateSplit(split) {
  assertValid("split.diff", split.diff, "number", Number.isInteger(split.diff) && split.diff >= 0, "0以上の整数");
  assertValid("split.priority", split.priority, "number", [1, 2].includes(split.priority), "1 または 2");
}
function validateAlign(align) {
  const validAligns = ["start", "end", "center", "justify"];
  ["start", "end"].forEach((pos) => {
    assertValid(`align.${pos}`, align[pos], "string", validAligns.includes(align[pos]), validAligns.join(", "));
  });
}

// src/ts/code/split.ts
var { ImplementationError } = ErrorClass.make("ImplementationError");

class WarichuSplitResult {
  static NONE = Symbol("WarichuSplitResult.NONE");
  _value;
  constructor(index, skip = 0) {
    this._value = index !== undefined && Number.isInteger(index) && index >= 0 ? { index, skip } : WarichuSplitResult.NONE;
  }
  exist() {
    return this._value !== WarichuSplitResult.NONE;
  }
  get value() {
    return this._value;
  }
}

class WarichuSplitStrategy {
  options;
  constructor(options) {
    this.options = options;
  }
}

class ExplicitSplitStrategy extends WarichuSplitStrategy {
  calc(graphemes) {
    const separator = this.options.syntax.separator;
    const index = graphemes.indexOf(separator);
    if (index === -1)
      return new WarichuSplitResult;
    if (graphemes.indexOf(separator, index + 1) !== -1) {
      throw new WarichuError(`割注に分割記号「${separator}」が複数あります。一個まで有効です。`);
    }
    if (index === 0 || index === graphemes.length - 1) {
      throw new WarichuError(`割注の片方の行が空です。指定分割位置は先頭・末尾以外の箇所であるべきです。: index:${index} (${index === 0 ? "先頭" : "末尾"})`);
    }
    const skip = getSegments(separator).length;
    return new WarichuSplitResult(index, skip);
  }
}

class SegmentSplitStrategy extends WarichuSplitStrategy {
  calc(content, totalLen) {
    const { diff, priority } = this.options.split;
    const wordSegments = getSegments(content, "word");
    if (wordSegments.length <= 1)
      return new WarichuSplitResult;
    const candidates = [];
    let currentLen = 0;
    for (let i = 0;i < wordSegments.length - 1; i++) {
      currentLen += getSegments(wordSegments[i], "grapheme").length;
      const absDiff = Math.abs(2 * currentLen - totalLen);
      if (absDiff <= diff)
        candidates.push(currentLen);
    }
    if (candidates.length === 0)
      return new WarichuSplitResult;
    const minAbsDiff = Math.min(...candidates.map((c) => Math.abs(2 * c - totalLen)));
    const bestCandidates = candidates.filter((c) => Math.abs(2 * c - totalLen) === minAbsDiff);
    const index = bestCandidates.length === 1 ? bestCandidates[0] : priority === 1 ? bestCandidates.find((c) => 2 * c >= totalLen) : bestCandidates.find((c) => 2 * c < totalLen);
    return new WarichuSplitResult(index);
  }
}

class HalfSplitStrategy extends WarichuSplitStrategy {
  calc(totalLen) {
    return new WarichuSplitResult(Math.ceil(totalLen / 2));
  }
}

class WarichuSplitter {
  _;
  constructor(options) {
    this._ = {
      options,
      strategies: [ExplicitSplitStrategy, SegmentSplitStrategy, HalfSplitStrategy].map((StrategyClass) => new StrategyClass(options))
    };
  }
  split(content) {
    const graphemes = getSegments(content, "grapheme");
    const totalLen = graphemes.length;
    return this.toTwin(graphemes, this.fallback(content, graphemes, totalLen));
  }
  makeArgs(content, graphemes, totalLen) {
    return [
      [graphemes],
      [content, totalLen],
      [totalLen]
    ];
  }
  fallback(content, graphemes, totalLen, splitChar) {
    const argsList = this.makeArgs(content, graphemes, totalLen, splitChar);
    for (let i = 0;i < this._.strategies.length; i++) {
      const res = this._.strategies[i].calc(...argsList[i]);
      if (res.exist())
        return res.value;
    }
    throw new ImplementationError("実装エラー。実行されてはならないパスに到達しました。ソースコードの内容が間違っています。最後の分割戦略は必ず有効値を返すべきです。実行順序や実装内容を修正してください。");
  }
  toTwin(graphemes, pos) {
    return [
      graphemes.slice(0, pos.index).join(""),
      graphemes.slice(pos.index + pos.skip).join("")
    ];
  }
}

// src/ts/code/main.ts
class Warichu {
  _;
  constructor(options = {}) {
    const normalized = normalize(options);
    validate(normalized);
    this._ = {
      options: normalized,
      splitter: new WarichuSplitter(normalized)
    };
  }
  get options() {
    return JSON.parse(JSON.stringify(this._.options));
  }
  parse(text) {
    const { open, close } = this._.options.syntax.enclosers;
    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`${escapeRegExp(open)}(.*?)${escapeRegExp(close)}`, "g");
    return text.replace(pattern, (_, content) => {
      const [startStr, endStr] = this._.splitter.split(content);
      return this.generateHtml(startStr, endStr);
    });
  }
  generateHtml(startText, endText) {
    const { brackets, align } = this._.options;
    const copyAttr = brackets.copyable ? "" : ' aria-hidden="true" style="user-select: none; -webkit-user-select: none;"';
    const bracketClass = `warichu-bracket${brackets.narrow ? " is-narrow" : ""}`;
    const bracketHtmls = brackets.chars.map((c) => c ? `<span class="${bracketClass}"${copyAttr}>${c}</span>` : "");
    const contentHtml = ["start", "end"].map((pos) => {
      const text = pos === "start" ? startText : endText;
      const style = `text-align-last: ${align[pos]};`;
      return `<span class="warichu-${pos}" style="${style}">${text}</span>`;
    }).join("");
    return `<span class="warichu-container">` + bracketHtmls[0] + `<span class="warichu-content">${contentHtml}</span>` + bracketHtmls[1] + `</span>`;
  }
}
if (typeof globalThis !== "undefined") {
  globalThis["Warichu"] = Warichu;
}
if (typeof window !== "undefined") {
  window["Warichu"] = Warichu;
}
export {
  Warichu
};
