/**
 * src/ts/common/ja-segment.ts
 * 日本語テキストの分割（字、語、節、文）を担当する共通モジュール
 */
export class JaSegment {
  static get granularities() { return ['grapheme', 'word', 'phrase', 'sentence'] as const; }
  static toChars(text: string): string[] { return this.segment('grapheme', text); }
  static toWords(text: string): string[] { return this.segment('word', text); }
  static toPhrases(text: string): string[] { return this.segment('phrase', text); }
  static toSentences(text: string): string[] { return this.segment('sentence', text); }
  static segment(granularity: 'grapheme' | 'word' | 'phrase' | 'sentence' = 'grapheme', text: string): string[] {
    return JaSegmentFactory.segment(granularity, text);
  }
}
class JaSegmentFactory {
  private static get(granularity: 'grapheme' | 'word' | 'phrase' | 'sentence', text: string): string[] {
    return granularity === 'phrase'
      ? PhraseSegmenter.segment(text)
      : JaIntlSegmenter.isSupported
        ? JaIntlSegmenter.segment(granularity, text)
        : DefaultSegmenter.segment(granularity, text);
  }
  static segment(granularity: 'grapheme' | 'word' | 'phrase' | 'sentence', text: string): string[] {
    return this.get(granularity).segment(granularity as any, text);
  }
}
class DefaultSegmenter {
  static segment(granularity: string, text: string): string[] {
    if (granularity !== 'grapheme') {
      throw new Error(`DefaultSegmenterは 'grapheme' のみサポートしています。実際値: ${granularity}`);
    }
    return Array.from(text);
  }
}
class JaIntlSegmenter {
  private static cache = new Map<string, Intl.Segmenter>();
  static get isSupported(): boolean {
    return typeof Intl !== 'undefined' && !!Intl.Segmenter;
  }
  private static get(granularity: 'grapheme' | 'word' | 'sentence'): Intl.Segmenter {
    if (!this.cache.has(granularity)) {
      this.cache.set(granularity, new Intl.Segmenter('ja', { granularity }));
    }
    return this.cache.get(granularity)!;
  }
  static segment(granularity: 'grapheme' | 'word' | 'sentence', text: string): string[] {
    return Array.from(this.get(granularity).segment(text)).map(s => s.segment);
  }
}
class PhraseSegmenter {
  static segment(granularity: 'phrase', text: string): string[] {
    throw new Error('phrase分割(BudouX等)は未実装です。');
  }
}

