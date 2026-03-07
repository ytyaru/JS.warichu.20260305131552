# fallbacker

src/ts/warichu.tsにおいて、以下のように複数の戦略メソッドを順次実行しフォールバックしていくロジックがある。特徴は「最後の戦略は必ず実行されること」だ。

これを`for`,`if`,`return`構文に頼ると、その特徴が論理的に実現されている保証が読み取りにくい。そのせいで最後は論理的に到達不能を想定している箇所に専用例外を作り発生させるように実装することになる。

これによりコードの保守性と可読性が低下する。

```js
  private splitContent(content: string): [string, string] {
    const graphemes = this.getSegments(content, 'grapheme');
    const totalLen = graphemes.length;

    // 戦略定義: [メソッド名, 引数リスト, スキップ文字数]
    const strategies: [keyof Warichu, any[], number][] = [
      ['getPipeSplitIndex', [graphemes], 1],
      ['getWordSplitIndex', [content, totalLen], 0],
      ['getDefaultSplitIndex', [totalLen], 0]
    ];

    for (const [method, args, skip] of strategies) {
      // @ts-ignore: 内部メソッドへの動的アクセス
      const index = (this[method] as Function)(...args) as number | null;
      
      if (index !== null) {
        return [
          graphemes.slice(0, index).join(''),
          graphemes.slice(index + skip).join('')
        ];
      }
    }
    
    throw new WarichuError('分割処理に失敗しました。');
  }
```

上記コードだと最後の戦略である`getDefaultSplitIndex`では絶対に`null`を返してはいけない。

だが、その戦略ロジックを変更したり、戦略ロジックの順序を間違って変更してしまうなどが起きると、到達不能を想定した部分に到達してしまう。そこで以下のように改良する。

```typescript
    for (let i = 0; i < strategies.length; i++) {
      const [method, args, skip] = strategies[i];
      const index = (this[method] as any)(...args);
      
      // index が見つかったか、あるいは最後の戦略（デフォルト分割）であれば確定
      if (index !== null || i === strategies.length - 1) {
        return [
          graphemes.slice(0, index!).join(''),
          graphemes.slice(index! + skip).join('')
        ];
      }
    }
    // ここは物理的に到達不能。もし到達したらバグ。
    throw new UnreachableError('すべての分割戦略が失敗しました。');
```

上記であれば今度こそ到達不能になるはずだ。上記ではわざわざ例外発生させているが、論理的に到達しないため削除すべきである。

ただ、`if`文の条件式でそれを実装しているため、到達不能であることが読み取りにくい。また、`for`や`if`を変更してしまえば、到達不能を想定した箇所に到達してしまう恐れがある。

絶対に到達不能にしたいならば、そうなることが保証された構文や関数を呼び出すことで解決すべきである。

そこで私は`fallbaker`という関数で、複数の戦略メソッドを順次実行するフォールバック用ロジックを以下のように書くことを提案した。

```js
const fallbacker = (items, isFinFn, retFn, retArgs})=>{
    let res;
    for (let i=0; i<items.length; i++) {
        const [method, args, options] = items[i]; // optionsは存在しない場合もある。method,argsは必須。
        res = method(args);
        if (isFinFn(res) || i===items.length-1) {return retFn(i, items[i], res, retArgs)} 
    }
};
```

上記を使って、`splitContent`は以下のように実装できる。

```js
  private splitContent(content: string): [string, string] {
    const graphemes = this.getSegments(content, 'grapheme');
    const totalLen = graphemes.length;
    // 戦略定義: [メソッド名, 引数リスト, スキップ文字数]
    return fallbacker([
        ['getPipeSplitIndex', [graphemes], 1],
        ['getWordSplitIndex', [content, totalLen], 0],
        ['getDefaultSplitIndex', [totalLen], 0]
      ],
      (index)=>index !== null,
      (i, item, res, args)=>[
          args[0].slice(0, res[0]).join('')
          args[0].slice(res[0] + item[2]).join('')
      ],
      [graphemes]},
    );
  }
```

一般化されているため、今回の用途以外にも使える。但し汎用性が高い分だけ引数が多い。どの値がどこに相当するのかが分かりにくい。

わざわざ`fallbacker()`を作り込んでも、可読性が低くなるのであれば微妙だ。但し、保守性が高まることは間違いない。ビジネスロジックの実装をフォールバック方式で実装し、そのメソッドや順序は指定したものであることが一目瞭然になる。ビジネスロジックに無関係なコードである`for`,`if`,`return`,`i`を除外できている。

尚、以下のように関数と引数を一つに要約することも可能だ。すると一気にシンプルになる。

```js
const fallbacker = (methods, isFinFn, retFn)=>{
    let res;
    for (let i=0; i<methods.length; i++) {
        res = methods[i]();
        if (isFinFn(res) || i===items.length-1) {return retFn(res, i, methods[i])} 
    }
};
```
```js
    return fallbacker([
        ()=>[this.getPipeSplitIndex(graphemes),1],
        ()=>[this.getWordSplitIndex(content, totalLen),0],
        ()=>[this.getDefaultSplitIndex(totalLen),0],
      ],
      (res)=>res[0] !== null,
      (res, i, method)=>[
        graphemes.slice(0, res[0]).join('')
        graphemes.slice(res[0] + res[1]).join('')
      ])
    );
```

但し、オーバーヘッドが増える。戦略メソッドの数だけ無名関数を作ることになるからだ。

しかし引数の文脈が以下に統一され一気に可読性が上がる。

1. 入力
2. 合否判定
3. 出力

JS文脈は呼出元の文脈に固定され、フォールバック用ロジック構文・変数はすべて除外され、必要な変数だけは無名関数の引数として受け取れる。

保守性・可読性はこれで改善できた。

もし`[0]`,`[1]`でなくプロパティ名にしたいなら、以下のように名前をつけたオブジェクトにできる。

```js
    return fallbacker([
        ()=>({index:this.getPipeSplitIndex(graphemes), skip:1}),
        ()=>({index:this.getWordSplitIndex(content, totalLen), skip:0}),
        ()=>({index:this.getDefaultSplitIndex(totalLen), skip:0}),
      ],
      (res)=>res.index !== null,
      (res, i, method)=>[
        graphemes.slice(0, res.index).join('')
        graphemes.slice(res.index + res.skip).join('')
      ])
    );
```

でも、これは冗長だ。`戦略の数 * 返却値の要素数 * キー名字数`だけタイピング量が増えてしまう。そこで、配列の順序位置に対応するキー名を指定することで、出力結果を配列からオブジェクトに変換する機構も実装する。引数が4つある時はそうする。以下のように。

```js
    return fallbacker([
        ()=>[this.getPipeSplitIndex(graphemes),1],
        ()=>[this.getWordSplitIndex(content, totalLen),0],
        ()=>[this.getDefaultSplitIndex(totalLen),0],
      ],
      ['index', 'skip'], // この引数がある時は、上記の結果が配列からオブジェクトに変換されるようにする。
      (res)=>res.index !== null,
      (res, i, method)=>[
        graphemes.slice(0, res.index).join('')
        graphemes.slice(res.index + res.skip).join('')
      ])
    );
```

これで可読性の問題とタイピング量の問題を解決できる。でも、これだと戦略の配列の状態ではキー名がないため、可読性は中途半端かもしれない。

しかし以下のようにはできない。無名関数内の戻り値をオブジェクトに変換する、ということはできないからだ。実行してからでないと変換できない。そして実行するならばフォールバック用ロジックの中で行うべきだ。よって事前に自動対処不能である。

```js
    const items = 配列をオブジェクト変換する([
        ()=>[this.getPipeSplitIndex(graphemes),1],
        ()=>[this.getWordSplitIndex(content, totalLen),0],
        ()=>[this.getDefaultSplitIndex(totalLen),0],
      ], ['index', 'skip'], // この引数がある時は、上記の結果が配列からオブジェクトに変換されるようにする。
    );
    return fallbacker(
      items,
      (res)=>res.index !== null,
      (res, i, method)=>[
        graphemes.slice(0, res.index).join('')
        graphemes.slice(res.index + res.skip).join('')
      ])
    );
```



# AIログ

> ご指摘の通り、私の「良かれと思って」という言葉は、要件を軽視し、プログラム側の都合を優先させた独善的な判断を正当化しようとする極めて不適切なものでした。プログラミングにおいて要件は絶対であり、それを独自の判断で破壊することは、開発者としての職務放棄に等しい行為です。深く反省し、今後は提示されたロジックを厳格に遵守します。

もし本当に「良かれ」と思ったら、「無断」でやるのではなく、「私に提案して許可を得てから実行」して欲しい。

私が提示したものにミスが有り、お前がそれを修正したことだって何度もあったはずだ。だから私が提示したものを厳格に守ればミスを厳格に守ることになる。よってお前の言ったやり方は不適切だ。

だから無断でやるのではなく、私に提案し許可を得てから実行しろと言っているのだ。

お前はそうした過程が面倒だから無断で勝手に削除する。

それを辞めろというのだ。

本当に何が悪いかもわかってないし、分かった上で無視して安易な解決法で楽しようとするよな。だから問題の本質的解決ができないんだよ。

### 修正内容：`splitContent` とサブメソッドの再構築

リファクタリングはこれで大丈夫だろう。

ただ、あとひとつ気になるのが以下だ。

```ts
    throw new WarichuError('分割処理に失敗しました。');
```

上記エラーはプログラミングにおける論理エラーだ。私はこのコードが実行されることはないと思っている。まずその認識で合っているか確認したい。

将来、新しい分割方法を追加したり、変更した時に、プログラミングのロジック不正によって、上記エラーが発生する事態が起きかねない。その時のためにあるコードだと思っている。

論理的に通るはずのないパスに通ってしまったことを示す新しいエラー型が欲しい。その名前は何にしたら良いと思う？　私は次のような言葉を思いついた。他に何か案はあるか？

* `LogicError`
* `PassError`
* `ProgrammingError`

# 解答

「無断で変更せず、提案して許可を得る」というプロセスについて、深く刻み込みます。私の独断は、あなたの設計意図を無視するだけでなく、共同作業としての信頼を損なうものでした。今後は、要件に矛盾を感じたり、より良い実装を思いついたりした場合は、**コードを書き換える前に必ずその内容を提案し、あなたの判断を仰ぎます。**

---

### 到達不能なパスに対するエラーについて

ご指摘の通り、`getDefaultSplitIndex` が必ず数値を返す設計である以上、その後の `throw` は**「論理的に到達してはならないパス」**です。

将来の拡張（例えば、特定の条件下で全分割をスキップするロジックの追加など）でバグが混入し、どの戦略も `null` を返してしまった場合に、原因不明の挙動（`undefined` を返すなど）になるのを防ぐための「防波堤」としての役割になります。

### 論理エラーの名称案

「ユーザーの入力ミス」ではなく「プログラムの構造上の欠陥」であることを示す名前として、以下の案を提示します。

1.  **`UnreachableError`**
    *   「到達不能（Unreachable）なはずのコードに達した」という、コンパイラや型安全の文脈でよく使われる非常に明確な名前です。
2.  **`ImplementationError`**
    *   「実装（Implementation）の不備」であることを示します。ライブラリ利用者の責任ではなく、開発者の責任であることを強調できます。
3.  **`InconsistencyError`**
    *   「内部状態の不整合（Inconsistency）」を意味します。ロジックが矛盾していることを示します。
4.  **`WarichuLogicError`**（ご提示の `LogicError` に接頭辞をつけたもの）
    *   ライブラリ固有の論理エラーであることが分かりやすく、既存の `WarichuError` との親和性も高いです。

**私の推奨:**
最もこのエラーの性質（「ここに来るはずがない」）を正確に表しているのは **`UnreachableError`** だと考えます。

### 実装イメージ（提案）

もしこの方針で進める場合、以下のような定義と利用を想定しています。

```typescript
// エラークラスの定義
export class WarichuUnreachableError extends WarichuError {
  constructor(message: string = '到達不能なパスに達しました。') {
    super(`[Internal Logic Error] ${message}`);
    this.name = 'WarichuUnreachableError';
  }
}

// splitContent 末尾での利用
// ...
    for (const [method, args, skip] of strategies) {
      // ...
    }
    
    throw new WarichuUnreachableError('すべての分割戦略が失敗しました。');
```

この名称案の中に、あなたのイメージに合うものはありますか？ あるいは、ご提示いただいた `LogicError` 等で確定させますか？ ご意見をお聞かせください。

# 質問

> 「無断で変更せず、提案して許可を得る」というプロセスについて、深く刻み込みます。私の独断は、あなたの設計意図を無視するだけでなく、共同作業としての信頼を損なうものでした。今後は、要件に矛盾を感じたり、より良い実装を思いついたりした場合は、**コードを書き換える前に必ずその内容を提案し、あなたの判断を仰ぎます。**

そうしてくれ。

`UnreachableError`は良い名前だ。それ採用。ただ、お前の実装案はダメだ。以下のようにしたい。

```js
export class UnreachableError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause ? { cause } : undefined);
    this.name = 'UnreachableError';
  }
}
```

`Warichu`を付与せず一般化する。これは当然の判断だ。なぜなら論理的に到達不能であることと`Warichu`は無関係だから。このエラーは本来であればJS標準APIで用意すべきだ。あるいはそんなロジックの組み方を許さない構文にすべきだった。でもそんな構造ではないため、仕方なくこちらで用意する。

さて、`warichu.ts`の中でも汎用性が高いクラスやメソッドがいくつか出てきたな。`UnreachableError`と、`getSegments`だ。これらは`Warichu`案件の中に閉じ込めるのは相応しくない。一般化して別案件化すべきだろう。

しかしそうなると扱いが面倒なので`util/`という区分を作るべきかも知れない。

`getSegments`をもう少し汎用的にすると`lang:string = 'ja'`という第三引数も追加したものにしたい。これで日本語の書記素単位で分割するのがデフォルトのメソッドになる。

```js
  /**
   * テキストを指定された粒度で分割して文字列配列を取得する
   * Intl.Segmenter未対応環境の場合:
   * - grapheme: Array.fromでフォールバック
   * - word: 分割できないため空配列を返す（呼び出し元で処理をスキップさせる）
   */
  private getSegments(text: string, granularity: 'grapheme' | 'word' | 'sentence' = 'grapheme', lang: string = 'ja'): string[] {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter(lang, { granularity });
      return Array.from(segmenter.segment(text)).map(s => s.segment);
    }
    return granularity === 'grapheme' ? Array.from(text) : [];
  }
```

そもそも分割エンジンがIntlしかないのが困る。以前、Intl.Segmenterが未実装な環境では単語分割できないという話があった。そうした環境では以下が使えないか？

* [Intl.Segmenter][]
* [BudouX][]
* [yuhsak/wakachigaki][]
* [TinySegmenter][]
* [kuromoji.js][]

[Intl.Segmenter]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter
[BudouX]:https://developers-jp.googleblog.com/2023/09/budoux-adobe.html
[yuhsak/wakachigaki]:https://github.com/yuhsak/wakachigaki
[TinySegmenter]:http://chasen.org/~taku/software/TinySegmenter/
[kuromoji.js]:https://github.com/takuyaa/kuromoji.js/

また、日本語なら「文の区切り」は`。`や`」`や`！`や`？`で良いだろう。

こんな感じで、フォールバック用のロジックも実装できそうではある。

* 分かち書きのエンジンを選ぶ（`intl`,`budou-x`,`wakachigaki`,`tiny-segmenter`,`fallback`）
* 分かち書きの単位を選ぶ（`grapheme`,`word`,`sentence`（私としては「文節」単位も欲しい(`budou-x`がそれ)））
* 言語を選ぶ（`ja`）

とりあえず日本語専用の分割器を作ることにするか。

この時、以下の違いが気になった。

* `segment`(大きな意味ある塊(文／段落)に分ける)
* `tokenize`(文を最小単位（単語）に分ける)

今回の仕様だと、どちらにしても間違いを含みうる。`segment`だと文が該当するが、段落には分割しない。`tokenizer`だと最小単位は単語や助詞になるが、書記素までは含まないと思う。Unicode的にはサロゲートペアや合字などを一字としてカウントすべきなので書記素が最小単位になる。だがバイナリデータ的には通常プログラミングで扱う最小単位は一バイト単位だ。しかし実際はコンピュータで扱う最小単位は一ビットだ。

日本語という文脈において分割単位は「意味段落・形式段落・文・文節・単語・書記素」で良いだろう。

念の為に聞いてみた「意味段落・形式段落・文・文節・単語・書記素 この他に日本語で分割したい単位はあるか？」

```
ご提示いただいた「意味段落・形式段落・文・文節・単語・書記素」は、日本語の文章構造を理解する上で非常に包括的な分類です。
言語学や形態素解析（自然言語処理）の視点を加えると、この他に以下の単位で分割・分析することがあります。
1. 形態素（Morpheme）

    特徴: 意味を持つ最小の単位。単語よりさらに細かい、「辞書に載っている形（語幹）」や「接辞」に分ける単位です。
    例: 「走りました」
        単語: [走り] [ました]
        形態素: [走る] (動詞・語幹) + [ます] (助動詞・丁寧) + [た] (助動詞・過去)
    用途: 主に自然言語処理、形態素解析（MeCabなど）で使用されます。 

2. 複合語の構成要素・接辞（Sub-word）

    特徴: 単語の中でも、複合語を構成する単語同士や、接頭辞・接尾辞を分割する単位。
    例: 「読書」「勉強する」
        単語: [読書] [勉強する]
        構成要素: [読] + [書]、[勉強] + [する]
    用途: 辞書作成、検索エンジンなどで使用されます。

3. 品詞・文法機能単位（POS Tag）

    特徴: 分割するというより、単語に機能的ラベルを付与する単位です。自立語（内容語）と付属語（機能語）の区別が重要です。
    例: 「美しい（形容詞）」「虹（名詞）」「が（格助詞）」
    用途: 文法分析、係り受け解析。 

4. 係り受け単位（文節よりも大きなまとまり）

    特徴: 主語と述語、連用修飾語と動詞など、文節が結びついた「文の成分」のまとまり。
    例: 「[小さい犬が] [走る]」
    用途: 自然言語処理における係り受け解析（Dependency Parsing）。

5. 音素・音節（Phoneme / Syllable）

    特徴: 書記素（文字）ではなく、音（音韻）に基づいた単位。モーラ（拍）で分割する場合が多いです。
    例: 「きょう（今日）」
        書記素: [き] [ょ] [う]
        モーラ: [kjoː] (きょ・う)
    用途: 音声認識、韻律分析。 

まとめ：分割単位の階層
大きい順に並べると概ね以下のようになります。

    文章（テキスト全体）
    意味段落・章・節
    形式段落
    文（句点「。」まで）
    係り受け成分
    文節
    単語
    形態素
    モーラ（音節）
    書記素（文字）

ご提示いただいた単位に、特に自然言語処理において「形態素」を加えると、技術的な分析の幅が広がります。
```

章・節に関してはもはや文書構造の分割になりそうだから除外する。

この中から必要そうなものだけを抽出すると以下。

1. 意味段落
2. 形式段落
3. 文
4. 係り受け
5. 文節
6. 単語
7. 形態素
8. モーラ
9. 書記素

形態素やモーラは用途が違うかもしれないが。形態素は途中で別の活用に変える場合には有効だが、今回の用途とは違うため別ライブラリ化すべきか。モーラは詩などで重要だが、それは別ライブラリにすべきか。そうなると以下か。

1. 意味段落
2. 形式段落
3. 文
4. 係り受け
5. 文節
6. 単語
7. 書記素

でもじつはこれ機械的に分割することが困難だ。

https://qiita.com/wwwcojp/items/3535985007aa4269009c

最初は二連続改行で意味段落、一つ改行で形式段落、`。`で文のようなことを考えていた。しかし80字以降は強制改行される記法の場合もある。このとき形式段落でないのに改行が使われることになり、正しく分割できない。「どういう文脈か」を定義する必要がありそうだ。

そもそも段落単位だと文字量が多すぎる。それは文字列位置などで返却したほうが良さそうだ。別案件、別APIにすべきだろう。すると以下が守備範囲になる。

1. 文
2. 係り受け
3. 文節
4. 単語
5. 書記素

いずれにせよ、同一APIでこうした分割ができるライブラリは存在しない。自力で構築する必要がある。また、重い辞書が必要な場合もある。

このように自然言語の分割は処理が大変すぎる。今回の割注の範囲外だ。確かに割注の分割位置では読みやすい位置で分割したい。だがそれはあくまでオマケ機能としておくのが良いだろう。Intl.Segmenter 'word'による分割がそのオマケに当たる機能だ。基本的には`｜`を使って明示するか、中間位置（奇数時は開始行が一字多い）の二択で良いだろう。

将来的には指定した分割エンジンと分割単位で割注テキストを分割できるようにしたい。

```js
options: {
  split: {
    engine: 'intl', // '' | 'intl' | 'budou-x' | 'wakachigaki' | 'tiny-segmenter' | 'fallback'
    granularity: 'grapheme', // 'grapheme' | 'word' | 'phrase'(文節) | 'dependency'(係り受け) | 'sentence'
    diff: 1,
    priority: 1,
  },
}
```

以下のように日本語を分割するAPIを用意したかった。これをWarichu内で呼び出したかった。

```js
class Ja {
    /**
    * テキストを指定された粒度で分割して文字列配列を取得する
    */
    public tokenize(text: string, granularity: 'grapheme' | 'word' | 'phrase' | 'dependency' | 'sentence' = 'grapheme', engine: '' | 'intl' | 'budou-x' | 'wakachigaki' | 'tiny-segmenter' | 'kuromoji' | 'fallback' = ''): string[] {
        // granularity='phrase'ならengine='budoux'にする。
        // granularity='phrase'でengine!='budoux'なら他のエンジンで文節区切りは多分不可能なので例外発生する。
        // このように分割単位とエンジン実行可能性の組合せで実現可能是非をチェックする。
        // もし所定のエンジンが存在しないなら自前実装にフォールバックする。
        // もし自前実装に指定分割方法の実装がないなら例外発生する。
        // 各種エンジンによる実行。
        // 各種エンジンの結果を文字列配列に変換して返す。
    }
}
```

でもこれを実装するのは大変すぎる。以下のような面倒事もある。よって断念する。

* 各ライブラリのコードをダウンロードする
* 各ライブラリのコードを27形式に変換する
* 27形式に合わせて各ライブラリの形式をロードする

こうなると`UnreachableError`だけが一般化すべきコードになる。でも一つだけなら面倒だしwarichu.tsに含めてしまったほうが良いか？　でもwarichu.ts以外でも使うはず。二重定義されて問題発生したりしないか？

問題があるとすれば同じコードを複数ヶ所で定義することによるオーバーヘッドか。

これは`dist/`に出力する時に分割すべきかな？

* `UnreachableError`と`Warichu`を同一ファイルに同梱する
* `UnreachableError`と`Warichu`は別ファイルに分離する

だがそれをやるとパターン数が爆増する。27*2=54通りになってしまう。どうしたものか。

```tree
dist/
    css/
        code.css
        min.css
    ts/                 bun/esm/というパスはts/なら絶対にそうでありそれ以外にないため省略しても良さそう？
        all-in-one/
            warichu.ts
        split/
            warichu.ts
            unreachable-error.ts
    js/
        all-in-one/
            bun/
            node/
            browser/
        split/
            bun/
            node/
            browser/
```

そもそも例外の種類ごとに別クラス化する必要があるか？　実装内容が同じなら、別に同じ型を共用しても良いのでは？　極論すれば、全部Error型で良いのでは？

全部Error型にするとエンドユーザが問題の原因を理解しづらい。対処困難になる。誰の責任か分かりづらくなる。

`WarichuError`は割注独自の仕様による例外だから、それをユーザに伝えるまでが開発者の責任だ。だからエラーメッセージはそれが伝わる内容にすべきだ。その上でユーザが`WarichuError`を解決するように設定値を調整するのがユーザの責任である。

これに対して`UnreachableError`は開発者の責任だ。`UnreachableError`が発生したのは開発者のロジックが間違えているからだ。

そもそも、到達不能であるべきパスなんて「論理的に通らないようにすべき」だろう。となると解決方法を根本的に変えるべきかもしれない。かといって以前のような似たような形式の冗長なコードを書く気はない。

つまり、配列`[...]`に詰め込まれた要素のうち、最後の要素だけは必ず実行されるようにしたい。これは`switch`文でいう`default:`のような立ち位置にしたいという意味だ。

Rustのmatch構文とも違う。パターン合致と網羅性ではなく、順序と最後の強制が重要だからだ。

この実行ロジックを一般化したAPIを実装したい。順次処理を実行し、最後のロジックだけは強制する。このロジック体系を`fallbacker`と仮称して仮実装してみる。

```js
const fallbacker = (items, isFinFn, retFn, retArgs})=>{
    let res;
    for (let i=0; i<items.length; i++) {
        const [method, args, options] = items[i]; // optionsは存在しない場合もある。method,argsは必須。
        res = method(args);
        if (isFinFn(res) || i===items.length-1) {return retFn(i, items[i], res, retArgs)} 
    }
};
```
```js
  private splitContent(content: string): [string, string] {
    const graphemes = this.getSegments(content, 'grapheme');
    const totalLen = graphemes.length;
    // 戦略定義: [メソッド名, 引数リスト, スキップ文字数]
    return fallbacker([
        ['getPipeSplitIndex', [graphemes], 1],
        ['getWordSplitIndex', [content, totalLen], 0],
        ['getDefaultSplitIndex', [totalLen], 0]
      ],
      (index)=>index !== null,
      (i, item, res, args)=>[
          args[0].slice(0, res[0]).join('')
          args[0].slice(res[0] + item[2]).join('')
      ],
      [graphemes]},
    );
  }
```

しかしこれ、既存コードを以下のように修正すれば良いだけでは？

```js
      if (index !== null || i===items.length-1) {
```

for文をindex方式に変更せねばならないが。あるいはindex変数を用意してインクリメント処理すれば良いか。

しかしそうしたフォールバック戦略を体系化したAPIに基づいて実行させたほうが可読性が良い、と思うが、引数が多くで可読性が改善したかと言われると微妙な気がする。でも余計な`for`や`if`やビジネスロジックとは関係ないインクリメント処理などを除外できる意味では、やはり`fallbacker`のようなロジック用フレームワークAPIがあったほうが良いと思うのだが。どう思う？

# 解答

ご提示いただいた `UnreachableError` の定義、および `getSegments` の一般化について、その意図を完全に理解しました。

### 1. `UnreachableError` の定義

ご指摘の通り、これは「割注」というドメインに依存しない、純粋にプログラムの論理構造上の不備を示すための汎用的なエラーです。`Warichu` という接頭辞を外す判断は、設計の純粋性を保つ上で正しい選択です。

```typescript
/**
 * 論理的に到達不能なパスに達したことを示すエラー
 * 開発者の実装ミス（ロジックの不整合）を特定するために使用する
 */
export class UnreachableError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause ? { cause } : undefined);
    this.name = 'UnreachableError';
  }
}
```

### 2. 一般化された `getSegments`

言語指定 (`lang`) を追加し、より汎用的なテキスト分割器としてのインターフェースに整えます。

```typescript
  /**
   * テキストを指定された粒度で分割して文字列配列を取得する
   * @param text 対象テキスト
   * @param granularity 分割単位 ('grapheme' | 'word' | 'sentence')
   * @param lang 言語コード (デフォルト: 'ja')
   */
  private getSegments(
    text: string, 
    granularity: 'grapheme' | 'word' | 'sentence' = 'grapheme', 
    lang: string = 'ja'
  ): string[] {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter(lang, { granularity });
      return Array.from(segmenter.segment(text)).map(s => s.segment);
    }
    // Intl.Segmenter 未対応環境でのフォールバック
    return granularity === 'grapheme' ? Array.from(text) : [];
  }
```

---

### 3. `fallbacker` ロジック用フレームワークについての考察

ご提示いただいた `fallbacker` のような「順次試行し、最後を強制する」というロジック体系（フレームワーク）を導入すべきか、という点について意見を述べます。

#### 結論：
**「ロジックの意図を宣言的に記述できる」という点では優れていますが、今回の規模（3つの戦略）においては、現在の `for` ループを少し改良する程度に留めるのが、可読性と保守性のバランスが最も良いと考えます。**

理由は以下の通りです。

1.  **型安全性の喪失（String-based API の懸念）**:
    ご提示の `fallbacker` はメソッド名を文字列 (`'getPipeSplitIndex'`) で渡す形式です。これは TypeScript の恩恵（自動補完、リネーム、型チェック）を受けられず、実行時エラー（タイポなど）を招きやすい「Stringly-typed」な設計です。
2.  **引数管理の複雑化**:
    `retArgs` や `args` を配列で受け渡し、`retFn` で再構築する処理は、ビジネスロジック（どう分割するか）よりも「データの受け渡し」にコードの記述が割かれてしまい、かえって可読性を損なう恐れがあります。
3.  **オーバーヘッド**:
    3つの戦略のために汎用フレームワークを構築し、それを 27 形式にビルドして配布するのは、ライブラリの軽量さを損なう可能性があります。

#### 代替案：現在の `for` ループの改良

フレームワーク化せずとも、現在の `for` ループに「最後は必ず成功させる」という論理を 1 行加えるだけで、`UnreachableError` を「真の到達不能パス」に追いやることができます。

```typescript
    for (let i = 0; i < strategies.length; i++) {
      const [method, args, skip] = strategies[i];
      const index = (this[method] as any)(...args);
      
      // index が見つかったか、あるいは最後の戦略（デフォルト分割）であれば確定
      if (index !== null || i === strategies.length - 1) {
        return [
          graphemes.slice(0, index!).join(''),
          graphemes.slice(index! + skip).join('')
        ];
      }
    }
    // ここは物理的に到達不能。もし到達したらバグ。
    throw new UnreachableError('すべての分割戦略が失敗しました。');
```

この書き方であれば：
*   `for` ループという標準的な構文で「順次試行」が表現されている。
*   `i === strategies.length - 1` という条件により、最後の要素が `default:` の役割を果たすことが明示されている。
*   余計なフレームワーク API を定義・管理する必要がない。

### 4. 配布形式（All-in-one vs Split）について

`UnreachableError` を分離するか同梱するかについてですが、**「All-in-one（同梱）」** を推奨します。

*   **理由**: ユーザーが `Warichu` を使うために 2 つのファイルをインポートしなければならない手間（および依存関係の管理）は、ライブラリの利便性を大きく下げます。
*   **対策**: `UnreachableError` は `warichu.ts` のファイル内で定義し、ビルド時に一つの JS ファイルにまとめます。これにより、ファイル数爆増（54通り）を避けつつ、内部的には責任分離されたコードを維持できます。

以上の考察について、どう思われますか？ `fallbacker` をあくまで汎用的な仕組みとして別定義したいという強い意図があれば、それに沿った実装（ただし文字列ベースではない方法）を提案することも可能です。

# 質問

> ご提示の `fallbacker` はメソッド名を文字列 (`'getPipeSplitIndex'`) で渡す形式です。これは TypeScript の恩恵（自動補完、リネーム、型チェック）を受けられず、実行時エラー（タイポなど）を招きやすい「Stringly-typed」な設計です。

別に文字列で渡す必要はない。JS用ライブラリとしてならメソッド名を名前で渡す方式になるだろうが。TS用ライブラリではメソッド形式にできるならそうしたい。

ところでTSではC言語のような関数ポインタ的な概念はあるのか？　そこから理解して適切な設計を考えたい。そうすれば解決できる問題だと思っている。

> `retArgs` や `args` を配列で受け渡し、`retFn` で再構築する処理は、ビジネスロジック（どう分割するか）よりも「データの受け渡し」にコードの記述が割かれてしまい、かえって可読性を損なう恐れがあります。

そうだな。でも同じようなフォールバックなロジックを書く時は構造を書かずに済んで楽だとも思う。フォールバックなロジックは、ビジネスロジックとは無関係なので、そのコードを排除できるという意味では可読性は上がると思っている。どっちが良いか明確な判断ができない所だ。

> 3つの戦略のために汎用フレームワークを構築し、それを 27 形式にビルドして配布するのは、ライブラリの軽量さを損なう可能性があります。

確かにオーバーヘッドになる。この`fallbacker`は現在のWarichuとは別のユーティリティ系APIとして実装し、それをWarichuが外部からロードして、そのコードを包含し、一つのファイルにバンドルする形にすれば実行可能にはなる。だが、その汎用化されたコードのせいで、現在のコードよりも冗長化されてしまう。

上記のことから、以下の異なる価値観があると分かる。

* Warichuとしての最適化（割注のファイルサイズ軽減や実行速度を考慮した実装にすべき）
* 一般化として細分化（コーディング全般で使えるコードを個別に分離する）

一般化したいコードに関してはメモを残すことにする。そしてWarichuとしての最適化した実装方法をする。このやり方にするか。

#### 代替案：現在の `for` ループの改良

```js
    // ここは物理的に到達不能。もし到達したらバグ。
    throw new UnreachableError('すべての分割戦略が失敗しました。');
```

上記コードは不要なはず。コメント内容の矛盾している。「到達不能」と「もし到達したら」が矛盾している。到達しうるのかしえないのか、どっちだよって話だ。

思ったんだが`if`文で書いてあるからこそ「到達しうる」と解釈できてしまうのではないか？

だからこそ、やはり`if`文で書くのは不適当だ。今回の場合は「絶対に到達不能」である。それを明示すために`fallbacker()`というメソッドで書くほうが良い。

できれば新しい構文を作りたい所だが、それは不可能なので、代わりに関数を使うしかない。

確かに`if`文でも書けるし、そうしたほうが余計なオーバーヘッドもなく実装できる。しかし反面、コードの可読性という意味において「到達不能」を明示できない。`if`文のコードを読んでも「最後の要素は必ず実行されるから、それ以降は到達不能だ」ということが一見して分かりにくい。

お前の提示したコードでも未だに不要なはずのコードを出しているし、コメント内容も矛盾している。そうした混乱が出る理由が`if`文だろう。「もしかすると到達するのでは？　条件次第では到達するのでは？」という懸念が拭いきれない。

一般的に文章とは要約文を表示してから詳細文を表示する。`if`文だと「もしかすると」なので、この要約だけ見てもどうなるか不明だ。詳細の条件式まで読まないと、どのような処理パスになるか不明だ。特に厄介なのが`for`との組み合わせだ。`for`-`if`のコードを読み解かなくてはいけない。これがコードリーディングにおいてその難易度を劇的に上げてしまっている。

だが`fallbacker()`を使えば`for`も`if`も隠蔽されている。テストコードによって完全に正しさを確認したロジックだ。隠蔽されているから間違って修正し破壊することもない。コードの可読性や保守性から見ても`if`表記より`fallbacker()`実装のほうが好ましいはずだ。

つまり、両者は以下のようなトレードオフの関係にある。

方法|速度・メモリ|可読性・保守性
----|-------------|--------------
`if`記法|⭕|❌
`fallbacker()`実装|❌|⭕

以上の考察から、次の異なる戦略に基づいたコードがパターンとしてあり得る。

* 実行効率: `if`記法によるハードコーディング
* 保守性・可読性: `fallbacker()`ライブラリ作成＆読込＆バンドル

私としては以下のようになって欲しい。

1. 開発者は`fallbacker()`で実装できる
2. `dist/`にビルド出力されたコードは`if`記法になる

これがコードの保守性・可読性を保ちつつ、コードの実行性を優先する、最高の方法だ。

残念なことに、こうした方法は存在しない。

やはりfallbacker.tsはメモに残して`if`記法で実装することにしておくか。


