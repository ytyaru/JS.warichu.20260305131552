// src/ts/warichu.ts
class WarichuError extends Error {
  constructor(message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "WarichuError";
  }
}
var defaultOptions = {
  brackets: { chars: ["(", ")"], copyable: true, narrow: false },
  split: { diff: 1, priority: 1 },
  align: { start: "start", end: "start" },
  error: "throw"
};

class Warichu {
  _;
  constructor(options = {}) {
    this._ = {
      options: {
        brackets: { ...defaultOptions.brackets, ...options.brackets },
        split: { ...defaultOptions.split, ...options.split },
        align: { ...defaultOptions.align, ...options.align },
        error: options.error ?? defaultOptions.error
      }
    };
    this.normalizeOptions();
    this.validateOption();
  }
  get options() {
    return JSON.parse(JSON.stringify(this._.options));
  }
  normalizeOptions() {
    const { brackets } = this._.options;
    if (!brackets)
      return;
    if (typeof brackets.chars === "string") {
      brackets.chars = this.getSegments(brackets.chars);
    }
    if (Array.isArray(brackets.chars) && brackets.chars.length === 0) {
      brackets.chars = ["", ""];
    }
  }
  validateOptions() {
    const { brackets, split, align, error } = this._.options;
    const checkType = (key, value, expected) => {
      if (typeof value !== expected) {
        throw new WarichuError(`型が不正です。対象キー:${key} 期待値:${expected} 実際値:${typeof value}`);
      }
    };
    const checkValue = (key, value, isValid, expected) => {
      if (!isValid) {
        throw new WarichuError(`値が不正です。対象キー:${key} 期待値:${expected} 実際値:${String(value)}`);
      }
    };
    if (brackets) {
      const chars = brackets.chars;
      if (!Array.isArray(chars)) {
        throw new WarichuError(`型が不正です。対象キー:brackets.chars 期待値:string|string[] 実際値:${typeof chars}`);
      }
      const isLen2 = chars.length === 2;
      const areStrings = isLen2 && typeof chars[0] === "string" && typeof chars[1] === "string";
      const s0Len = areStrings ? this.getSegments(chars[0]).length : -1;
      const s1Len = areStrings ? this.getSegments(chars[1]).length : -1;
      const isEachLenValid = areStrings && (s0Len === 0 || s0Len === 1) && (s1Len === 0 || s1Len === 1);
      const isTotalValid = areStrings && (s0Len + s1Len === 0 || s0Len + s1Len === 2);
      if (!isLen2 || !areStrings || !isEachLenValid || !isTotalValid) {
        throw new WarichuError(`値が不正です。対象キー:brackets.chars 期待値:空か2字('', '()', [], ['(',')'] 等) 実際値:${JSON.stringify(chars)}`);
      }
      if (brackets.copyable !== undefined)
        checkType("brackets.copyable", brackets.copyable, "boolean");
      if (brackets.narrow !== undefined)
        checkType("brackets.narrow", brackets.narrow, "boolean");
    }
    if (split) {
      if (split.diff !== undefined) {
        checkType("split.diff", split.diff, "number");
        checkValue("split.diff", split.diff, Number.isInteger(split.diff) && split.diff >= 0, "0以上の整数");
      }
      if (split.priority !== undefined) {
        checkType("split.priority", split.priority, "number");
        checkValue("split.priority", split.priority, [1, 2].includes(split.priority), "1または2");
      }
    }
    const validAligns = ["start", "end", "center", "justify"];
    if (align) {
      if (align.start !== undefined) {
        checkType("align.start", align.start, "string");
        checkValue("align.start", align.start, validAligns.includes(align.start), validAligns.join(","));
      }
      if (align.end !== undefined) {
        checkType("align.end", align.end, "string");
        checkValue("align.end", align.end, validAligns.includes(align.end), validAligns.join(","));
      }
    }
    if (error !== undefined) {
      const isString = typeof error === "string";
      const isFunction = typeof error === "function";
      const isErrorClass = isFunction && error.prototype instanceof Error;
      const isValid = isString && (error === "throw" || error === "warn") || isFunction && !isErrorClass || isErrorClass;
      if (!isValid) {
        throw new WarichuError(`値が不正です。対象キー:error 期待値:'throw','warn',任意Errorクラス,任意関数 実際値:${String(error)}`);
      }
    }
  }
  handleError(message) {
    const behavior = this._.option.error;
    if (behavior === "throw") {
      throw new WarichuError(message);
    } else if (behavior === "warn") {
      console.warn(`[Warichu] ${message}`);
    } else if (typeof behavior === "function") {
      if (behavior.prototype && behavior.prototype instanceof Error) {
        const ErrorClass = behavior;
        throw new ErrorClass(message);
      } else {
        const shouldStop = behavior(message);
        if (shouldStop === true) {
          throw new WarichuError(`中断されました: ${message}`);
        }
      }
    }
  }
  getSegments(text, granularity = "grapheme") {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter("ja", { granularity });
      return Array.from(segmenter.segment(text)).map((s) => s.segment);
    }
    return granularity === "grapheme" ? Array.from(text) : [];
  }
  getSplitPoint(text) {
    const { diff = 1, priority = 1 } = this._.option.split;
    if (text.includes("｜")) {
      const parts = text.split("｜");
      if (parts.length > 2) {
        this.throwError("割注にパイプ｜が複数あります。一個まで有効です。");
        return parts[0].length;
      }
      if (parts[0].length === 0 || parts[1].length === 0) {
        this.throwError(`割注の片方の行が空です。: start:${parts[0]}, end:${parts[1]}`);
      }
      return parts[0].length;
    }
    const totalLen = this.getSegments(text).length;
    const idealCenter = totalLen / 2;
    const wordSegments = this.getSegments(text, "word");
    if (wordSegments.length > 0) {
      let bestSplitIndex = -1;
      let minDiff = Infinity;
      let currentLen = 0;
      for (const segment of wordSegments) {
        currentLen += this.getSegments(segment).length;
        const currentDiff = Math.abs(2 * currentLen - totalLen);
        if (currentDiff <= diff) {
          if (currentDiff < minDiff) {
            minDiff = currentDiff;
            bestSplitIndex = currentLen;
          }
        }
      }
      if (bestSplitIndex !== -1) {
        return bestSplitIndex;
      }
    }
    return Math.ceil(totalLen / 2);
  }
  generateHtml(startText, endText) {
    const { brackets, align } = this._.options;
    const chars = brackets?.chars || [];
    const copyAttr = brackets?.copyable ? "" : " user-select: none; -webkit-user-select: none;";
    const bracketClass = `warichu-bracket${brackets?.narrow ? " is-narrow" : ""}`;
    const bracketStyle = copyAttr ? ` style="${copyAttr.trim()}"` : "";
    const bracketHtmls = [chars[0], chars[1]].map((c) => c ? `<span class="${bracketClass}"${bracketStyle}>${c}</span>` : "");
    const startStyle = `text-align-last: ${align?.start};`;
    const endStyle = `text-align-last: ${align?.end};`;
    return `<span class="warichu-container">` + bracketHtmls[0] + `<span class="warichu-content">` + `<span class="warichu-start" style="${startStyle}">${startText}</span>` + `<span class="warichu-end" style="${endStyle}">${endText}</span>` + `</span>` + bracketHtmls[1] + `</span>`;
  }
  generateHtml(startText, endText) {
    const { brackets, align } = this._.options;
    const copyAttr = brackets?.copyable ? "" : ' aria-hidden="true" style="user-select: none; -webkit-user-select: none;"';
    const bracketClass = `warichu-bracket${brackets?.narrow ? " is-narrow" : ""}`;
    const bracketHtmls = brackets.chars.map((c) => c ? `<span class="${bracketClass}"${copyAttr}>${c}</span>` : "");
    const contentHtml = ["start", "end"].map((pos) => {
      const text = pos === "start" ? startText : endText;
      const style = `text-align-last: ${align?.[pos]};`;
      return `<span class="warichu-${pos}" style="${style}">${text}</span>`;
    }).join("");
    return `<span class="warichu-container">` + bracketHtmls[0] + `<span class="warichu-content">${contentHtml}</span>` + bracketHtmls[1] + `</span>`;
  }
  parse(text) {
    return text.replace(/〔(.*?)〕/g, (_, content) => {
      const cleanContent = content.replace(/｜/g, "");
      const graphemes = this.getGraphemes(cleanContent);
      let splitIndex;
      let startStr;
      let endStr;
      if (content.includes("｜")) {
        const parts = content.split("｜");
        startStr = parts[0];
        endStr = parts.slice(1).join("");
        this.getSplitPoint(content);
      } else {
        splitIndex = this.getSplitPoint(content);
        startStr = graphemes.slice(0, splitIndex).join("");
        endStr = graphemes.slice(splitIndex).join("");
      }
      return this.generateHtml(startStr, endStr);
    });
  }
}
if (typeof globalThis !== "undefined") {
  globalThis["Warichu"] = Warichu;
}
if (typeof window !== "undefined") {
  window["Warichu"] = Warichu;
}