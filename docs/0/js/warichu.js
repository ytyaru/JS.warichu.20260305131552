const Warichu = {
  // グローバル設定（パーサ引数で上書き可能）
  defaults: {
    sign: "（）",       // デフォルト括弧
    copyable: true,     // コピー可否
    align1: "justify",  // 1行目揃え
    align2: "justify",  // 2行目揃え
  },

  /**
   * 簡易構文 〔内容〕 または 〔上段｜下段〕 をパースしてHTML化
   * @param {string} text - 入力テキスト
   * @param {object} options - 個別設定
   */
  parse(text, options = {}) {
    const config = { ...this.defaults, ...options };
    
    // 〔 〕 で囲まれた部分を抽出
    const regex = /〔(.+?)〕/g;
    
    return text.replace(regex, (match, content) => {
      let [line1, line2] = content.split('｜');
      
      // 自動分割（｜がない場合、中央で分割）
      if (!line2) {
        const mid = Math.ceil(content.length / 2);
        line1 = content.slice(0, mid);
        line2 = content.slice(mid);
      }

      // 括弧の分割
      const [openSign, closeSign] = config.sign.split('');
      const copyAttr = config.copyable ? '' : 'aria-hidden="true" style="user-select:none;"';

      return `
<span class="warichu-container">
  <span class="warichu-bracket" ${copyAttr}>${openSign}</span>
  <span class="warichu-content">
    <span class="warichu-line1" style="text-align-last: ${config.align1};">${line1}</span>
    <span class="warichu-line2" style="text-align-last: ${config.align2};">${line2}</span>
  </span>
  <span class="warichu-bracket" ${copyAttr}>${closeSign}</span>
</span>`.replace(/\n\s*/g, ''); // 改行を除去して余白バグ防止
    });
  }
};
