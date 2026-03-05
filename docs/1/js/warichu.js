// 割注〔割注の内容が二行で入ります〕、割注の内容が｜二行で入ります
class Warichu {
  /**
   * @param {Object} config 
   * { sign: '（）', copyable: true, align1: 'justify', align2: 'justify', narrowSign: true }
   */
  constructor(config = {}) {
    this.config = {
      sign: '（）',
      copyable: true,
      align1: 'justify',
      align2: 'justify',
      narrowSign: true, // 全角括弧を半角幅にするか
      ...config
    };
    // 文章の自然な区切りを判定するセグメンター（日本語用）
    this.segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
  }

  /**
   * 自動分割位置の計算
   */
  _getAutoSplitPoint(content) {
    const segments = Array.from(this.segmenter.segment(content));
    if (segments.length <= 1) return Math.ceil(content.length / 2);

    const mid = content.length / 2;
    let bestOffset = 0;
    let minDiff = Infinity;

    // 最も中央に近い「単語の区切り」を探す
    for (const seg of segments) {
      const diff = Math.abs(seg.index - mid);
      if (diff <= minDiff) {
        minDiff = diff;
        bestOffset = seg.index;
      }
    }
    // 区切りが端に寄りすぎている場合は単純二分割をフォールバック
    return (bestOffset === 0 || bestOffset >= content.length) 
      ? Math.ceil(content.length / 2) 
      : bestOffset;
  }

  parse(text) {
    const { sign, copyable, align1, align2, narrowSign } = this.config;
    const regex = /〔(.+?)〕/g;

    return text.replace(regex, (match, content) => {
      let [line1, line2] = content.split('｜');

      if (line2 === undefined) {
        const splitAt = this._getAutoSplitPoint(content);
        line1 = content.slice(0, splitAt);
        line2 = content.slice(splitAt);
      }

      // 括弧の有無とHTML生成
      const signs = sign ? sign.split('') : [];
      const hasSign = signs.length >= 2;
      const copyAttr = copyable ? '' : 'aria-hidden="true" style="user-select:none;"';
      const bracketClass = `warichu-bracket${narrowSign ? ' is-narrow' : ''}`;

      const openTag = hasSign ? `<span class="${bracketClass}" ${copyAttr}>${signs[0]}</span>` : '';
      const closeTag = hasSign ? `<span class="${bracketClass}" ${copyAttr}>${signs[1]}</span>` : '';

      return (
`<span class="warichu-container">` +
  `${openTag}` +
  `<span class="warichu-content">` +
    `<span class="warichu-line1" style="text-align-last: ${align1};">${line1}</span>` +
    `<span class="warichu-line2" style="text-align-last: ${align2};">${line2}</span>` +
  `</span>` +
  `${closeTag}` +
`</span>`).replace(/\n/g, '');
    });
  }
}
