class WarichuError extends Error {
  constructor(message) {
    super(message);
    this.name = "WarichuError";
  }
}

class Warichu {
  config;
  segmenterWord;
  segmenterGrapheme;
  constructor(config = {}) {
    this.config = {
      sign: "（）",
      copyable: true,
      align1: "start",
      align2: "start",
      narrowSign: true,
      error: "warn",
      diff: 1,
      ...config
    };
    this.segmenterWord = new Intl.Segmenter("ja", { granularity: "word" });
    this.segmenterGrapheme = new Intl.Segmenter("ja", { granularity: "grapheme" });
  }
  getGraphemes(text) {
    return Array.from(this.segmenterGrapheme.segment(text)).map((s) => s.segment);
  }
  _handleError(message) {
    const { error } = this.config;
    if (error === "throw")
      throw new WarichuError(message);
    if (error === "warn") {
      console.warn(`[Warichu] ${message}`);
      return false;
    }
    if (typeof error === "function") {
      if (error.prototype instanceof Error) {
        const ErrorClass = error;
        throw new ErrorClass(message);
      }
      return error(message) === true;
    }
    return false;
  }
  _getSplitPoint(content) {
    const graphemes = this.getGraphemes(content);
    const total = graphemes.length;
    const { diff } = this.config;
    if (total < 2) {
      if (this._handleError(`割注は合計2文字以上必要です: "${content}"`))
        return total;
    }
    const pipeIndex = content.indexOf("｜");
    if (pipeIndex !== -1) {
      const l1 = this.getGraphemes(content.slice(0, pipeIndex)).length;
      const l2 = total - 1 - l1;
      if (l1 > 0 && l2 > 0)
        return pipeIndex;
      if (this._handleError("割注の片方の行が空です。"))
        return total;
      return this._getSplitPoint(content.replace("｜", ""));
    }
    const segments = Array.from(this.segmenterWord.segment(content));
    for (const seg of segments) {
      if (seg.index === 0 || seg.index === content.length)
        continue;
      const prefixCount = this.getGraphemes(content.slice(0, seg.index)).length;
      const suffixCount = total - prefixCount;
      if (prefixCount > 0 && suffixCount > 0 && Math.abs(prefixCount - suffixCount) <= diff) {
        return seg.index;
      }
    }
    const splitPos = Math.ceil(total / 2);
    return graphemes.slice(0, splitPos).join("").length;
  }
  parse(text) {
    const { sign, copyable, align1, align2, narrowSign } = this.config;
    const regex = /〔(.+?)〕/g;
    return text.replace(regex, (_, rawContent) => {
      const splitAt = this._getSplitPoint(rawContent);
      const content = rawContent.replace("｜", "");
      const line1 = content.slice(0, splitAt);
      const line2 = content.slice(splitAt);
      const signs = sign ? Array.from(this.segmenterGrapheme.segment(sign)).map((s) => s.segment) : [];
      const hasSign = signs.length >= 2;
      const copyAttr = copyable ? "" : ' aria-hidden="true" style="user-select:none;"';
      const bCls = `warichu-bracket${narrowSign ? " is-narrow" : ""}`;
      const open = hasSign ? `<span class="${bCls}"${copyAttr}>${signs[0]}</span>` : "";
      const close = hasSign ? `<span class="${bCls}"${copyAttr}>${signs[1]}</span>` : "";
      return `<span class="warichu-container">${open}<span class="warichu-content">` + `<span class="warichu-line1" style="text-align-last: ${align1};">${line1}</span>` + `<span class="warichu-line2" style="text-align-last: ${align2};">${line2}</span>` + `</span>${close}</span>`;
    });
  }
}
if (typeof globalThis !== "undefined") {
  globalThis["Warichu"] = Warichu;
}
if (typeof window !== "undefined") {
  window["Warichu"] = Warichu;
}


