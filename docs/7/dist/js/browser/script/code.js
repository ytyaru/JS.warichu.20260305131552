(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __moduleCache = /* @__PURE__ */ new WeakMap;
  var __toCommonJS = (from) => {
    var entry = __moduleCache.get(from), desc;
    if (entry)
      return entry;
    entry = __defProp({}, "__esModule", { value: true });
    if (from && typeof from === "object" || typeof from === "function")
      __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
        get: () => from[key],
        enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
      }));
    __moduleCache.set(from, entry);
    return entry;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, {
        get: all[name],
        enumerable: true,
        configurable: true,
        set: (newValue) => all[name] = () => newValue
      });
  };

  // src/js/warichu.ts
  var exports_warichu = {};
  __export(exports_warichu, {
    Warichu: () => Warichu
  });

  class Warichu {
    config;
    segmenterWord;
    segmenterGrapheme;
    constructor(config = {}) {
      this.config = {
        sign: "（）",
        copyable: true,
        align1: "justify",
        align2: "justify",
        narrowSign: true,
        ...config
      };
      this.segmenterWord = new Intl.Segmenter("ja", { granularity: "word" });
      this.segmenterGrapheme = new Intl.Segmenter("ja", { granularity: "grapheme" });
    }
    getGraphemes(text) {
      return Array.from(this.segmenterGrapheme.segment(text)).map((s) => s.segment);
    }
    _getAutoSplitPoint(content) {
      const graphemes = this.getGraphemes(content);
      const totalCount = graphemes.length;
      const mid = totalCount / 2;
      const isEven = totalCount % 2 === 0;
      const allowedDiff = isEven ? 0 : 0.5;
      const segments = Array.from(this.segmenterWord.segment(content));
      let bestSplitIndex = -1;
      for (const seg of segments) {
        if (seg.index === 0 || seg.index === content.length)
          continue;
        const prefixCount = this.getGraphemes(content.slice(0, seg.index)).length;
        const diff = Math.abs(prefixCount - mid);
        if (diff === allowedDiff) {
          bestSplitIndex = seg.index;
          break;
        }
      }
      if (bestSplitIndex === -1) {
        const splitPos = Math.ceil(totalCount / 2);
        return graphemes.slice(0, splitPos).join("").length;
      }
      return bestSplitIndex;
    }
    parse(text) {
      const { sign, copyable, align1, align2, narrowSign } = this.config;
      const regex = /〔(.+?)〕/g;
      return text.replace(regex, (_, content) => {
        let [line1, line2] = content.split("｜");
        if (line2 === undefined) {
          const splitAt = this._getAutoSplitPoint(content);
          line1 = content.slice(0, splitAt);
          line2 = content.slice(splitAt);
        }
        const signs = sign ? Array.from(this.segmenterGrapheme.segment(sign)).map((s) => s.segment) : [];
        const hasSign = signs.length >= 2;
        const copyAttr = copyable ? "" : ' aria-hidden="true" style="user-select:none;"';
        const bracketClass = `warichu-bracket${narrowSign ? " is-narrow" : ""}`;
        const openTag = hasSign ? `<span class="${bracketClass}"${copyAttr}>${signs[0]}</span>` : "";
        const closeTag = hasSign ? `<span class="${bracketClass}"${copyAttr}>${signs[1]}</span>` : "";
        return `<span class="warichu-container">` + `${openTag}` + `<span class="warichu-content">` + `<span class="warichu-line1" style="text-align-last: ${align1};">${line1}</span>` + `<span class="warichu-line2" style="text-align-last: ${align2};">${line2}</span>` + `</span>` + `${closeTag}` + `</span>`;
      });
    }
  }
})();
