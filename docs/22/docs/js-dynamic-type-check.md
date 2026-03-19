# JSにおける動的型チェックについて

JSで動的型チェックする具体的な方法について考察した。[JS/TSにおける型安全性の欠如と責任分離の不可能性][]を自前実装により少しでも改善しようとする悪足掻きである。

[JS/TSにおける型安全性の欠如と責任分離の不可能性]:./js-ts-fault.md

## 動的型チェックすべき場面

残念ながらブラウザ上で動作可能な言語は、言語不備を抱えたJSだけである。故にこの破綻した言語を使わざるを得ない。

型においては安全性と実行性のトレードオフになる。

観点|概要
----|----
安全性|型において予期せぬ実行時エラーが発生する可能性がないこと
実行性|ビジネスロジック以外(型チェック等)の処理が無いこと

場所によって以下のように使い分けるほうが良いだろう。

パターン|例
--------|--
動的型チェックすべき場合|型によって動作を変更する必要がある場合
動的型チェックしたほうが安全な場合|実行時予期せぬエラー可能性を排除したい場合(ライブラリ等)
動的型チェックしなくてもよい場合|外部から値を渡されない場合(外部参照不能な内部関数等)
動的型チェックすべきでない場合|プリミティブ／オブジェクトあらゆる型を許容すべき場合

### 動的型チェック

動的型チェックするための体系化された仕組みは無い。故に動的型チェック体系を自前で実装する必要がある。

* 単一型チェック
* 複合型チェック

#### 単一型チェック

最低でもプリミティブとオブジェクトの二つに大別すべきだ。

```javascript
Type.assert(target, fn);    // 指定した型であること（真偽値を返す）
Type.throw(target, fn);     // 指定した型であること（例外発生）
Type.to(target, fn);        // 指定した型に変換すること
```
```javascript
class Signeture {           // 動的オーバーロードするためのシグネチャ定義
    constructor(...args) {  // 引数配列1, 実行処理1, 引数配列2, 実行処理2, ...

    }
    route(...args) {...}
}
```
```javascript
class Generic {             // ジェネリクス（コンテナの要素型を定義する）

}
```
```javascript
// コンテナ型
// List,Stack,Queue,Tree,Grid,Graph,...
```

```javascript
Type.assert(target, a=>a.prm);              // Primitive
Type.assert(target, a=>a.prm.bln);          // Boolean
Type.assert(target, a=>a.prm.num);          // Number
Type.assert(target, a=>a.prm.num.nan);      // NaN
Type.assert(target, a=>a.prm.num.inf.p);    // PositiveInfinity
Type.assert(target, a=>a.prm.num.inf.n);    // NegativeInfinity
Type.assert(target, a=>a.prm.num.fin);      // isFinite
Type.assert(target, a=>a.prm.num.int);      // isInteger
Type.assert(target, a=>a.prm.num.p);        // isInteger && 0<=
Type.assert(target, a=>a.prm.num.n);        // isInteger && <0
Type.assert(target, a=>a.prm.num.z);        // 0
Type.assert(target, a=>a.prm.str);          // String
Type.assert(target, a=>a.prm.str.blk);      // ''
Type.assert(target, a=>a.prm.nul);          // Null
Type.assert(target, a=>a.prm.und);          // Undefined
Type.assert(target, a=>a.prm.sym);          // Symbol
Type.assert(target, a=>a.prm.int);          // BigInt
```
```javascript
Type.assert(target, a=>a.obj);          // Object
Type.assert(target, a=>a.obj.blk);      // Object.create(null)
Type.assert(target, a=>a.obj.exe);      // 'function'===typeof target
Type.assert(target, a=>a.obj.exe.ano);  // 匿名関数anonymous
Type.assert(target, a=>a.obj.exe.arr);  // アロー関数式
Type.assert(target, a=>a.obj.exe.con);  // コンストラクタ
Type.assert(target, a=>a.obj.exe.des);  // ディスクリプタ（ゲッターとセッター両方持っている）
Type.assert(target, a=>a.obj.exe.des.get);  // ゲッターのみ
Type.assert(target, a=>a.obj.exe.des.set);  // セッターのみ
Type.assert(target, a=>a.obj.exe.a);    // async
Type.assert(target, a=>a.obj.exe.g);    // generator
Type.assert(target, a=>a.obj.itr);      // Iterator
Type.assert(target, a=>a.obj.itr.a);    // AsyncIterator
Type.assert(target, a=>a.obj.promise);  // Promise
Type.assert(target, a=>a.obj.disack);   // DisposableStack
Type.assert(target, a=>a.obj.adisack);  // AsyncDisposableStack
Type.assert(target, a=>a.obj.reflect);  // Reflect
Type.assert(target, a=>a.obj.proxy);    // Proxy
Type.assert(target, a=>a.obj.intl);     // Intl
Type.assert(target, a=>a.obj.intl.col);     // Intl.Collator
Type.assert(target, a=>a.obj.intl.dt);      // Intl.DateTimeFormat
Type.assert(target, a=>a.obj.intl.name);    // Intl.DisplayNames
Type.assert(target, a=>a.obj.intl.dur);     // Intl.DurationFormat
Type.assert(target, a=>a.obj.intl.list);    // Intl.ListFormat
Type.assert(target, a=>a.obj.intl.loc);     // Intl.Locale
Type.assert(target, a=>a.obj.intl.num);     // Intl.NumberFormat
Type.assert(target, a=>a.obj.intl.plu);     // Intl.PluralRules
Type.assert(target, a=>a.obj.intl.time);    // Intl.RelativeTimeFormat
Type.assert(target, a=>a.obj.intl.seg);     // Intl.Segmenter
Type.assert(target, a=>a.obj.err);      // エラー型Error
Type.assert(target, a=>a.obj.err.agg);      // AggregateError
Type.assert(target, a=>a.obj.err.evl);      // EvalError
Type.assert(target, a=>a.obj.err.rng);      // RangeError
Type.assert(target, a=>a.obj.err.ref);      // ReferenceError
Type.assert(target, a=>a.obj.err.sup);      // SuppressedError
Type.assert(target, a=>a.obj.err.syn);      // SyntaxError
Type.assert(target, a=>a.obj.err.typ);      // TypeError
Type.assert(target, a=>a.obj.err.uri);      // URIError
Type.assert(target, a=>a.obj.err.itn);      // InternalError (非標準)
Type.assert(target, a=>a.obj.ctn);      // コンテナ
Type.assert(target, a=>a.obj.ctn.ary);      // 配列
Type.assert(target, a=>a.obj.ctn.map);      // Map
Type.assert(target, a=>a.obj.ctn.wmap);     // WeakMap
Type.assert(target, a=>a.obj.ctn.set);      // Set
Type.assert(target, a=>a.obj.ctn.wset);     // WeakSet
Type.assert(target, a=>a.obj.ctn.i8);       // Int8Array
Type.assert(target, a=>a.obj.ctn.u8);       // UInt8Array
Type.assert(target, a=>a.obj.ctn.u8c);      // UInt8ClampedArray
Type.assert(target, a=>a.obj.ctn.i16);      // Int16Array
Type.assert(target, a=>a.obj.ctn.u16);      // UInt16Array
Type.assert(target, a=>a.obj.ctn.i32);      // Int32Array
Type.assert(target, a=>a.obj.ctn.u32);      // UInt32Array
Type.assert(target, a=>a.obj.ctn.i64);      // BigInt64Array
Type.assert(target, a=>a.obj.ctn.u64);      // BigUInt64Array
Type.assert(target, a=>a.obj.ctn.f16);      // Float16Array
Type.assert(target, a=>a.obj.ctn.f32);      // Float32Array
Type.assert(target, a=>a.obj.ctn.f64);      // Float64Array
Type.assert(target, a=>a.obj.date);     // Date
Type.assert(target, a=>a.obj.tem);      // Temporal
Type.assert(target, a=>a.obj.tem.dur);  // Temporal.Duration
Type.assert(target, a=>a.obj.tem.ins);  // Temporal.Instant
Type.assert(target, a=>a.obj.tem.zdt);  // Temporal.ZonedDateTime
Type.assert(target, a=>a.obj.tem.zdt.ymd);  // Temporal.PlainDate
Type.assert(target, a=>a.obj.tem.zdt.ym);   // Temporal.PlainYearMonth
Type.assert(target, a=>a.obj.tem.zdt.day);  // Temporal.PlainMonthDay
Type.assert(target, a=>a.obj.tem.zdt.t);    // Temporal.PlainTime
Type.assert(target, a=>a.obj.reg);      // RegExp
Type.assert(target, a=>a.obj.url);      // URL
Type.assert(target, a=>a.obj.buf);      // ArrayBuffer
Type.assert(target, a=>a.obj.sbuf);     // SharedArrayBuffer
Type.assert(target, a=>a.obj.dv);       // DataView
Type.assert(target, a=>a.obj.atomics);  // Atomics
Type.assert(target, a=>a.obj.blob);     // Blob
Type.assert(target, a=>a.obj.file);     // File
Type.assert(target, a=>a.obj.math);     // Math
Type.assert(target, a=>a.obj.json);     // JSON
Type.assert(target, a=>a.obj.ref);      // WeakRef
Type.assert(target, a=>a.obj.fin);      // FinalizationRegistry
```

* プリミティブ
	* Boolean
	* Number
		* NaN
		* PositiveInfinity
		* NegativeInfinity
		* Integer（Number.MIN_SAFE_INTEGER〜Number.MAX_SAFE_INTEGER）
			* PositiveInteger(0〜Number.MAX_SAFE_INTEGER)
			* NegativeInteger(0〜Number.MIN_SAFE_INTEGER)
		* Float
		* Zero
	* BigInt
	* String
		* Blank
	* Symbol
	* Null
	* Undefined
* オブジェクト
	* Object
		* BlankObject	Object.create(null);
	* 実行可能型
		* `Function`オブジェクト
		* `function`定義関数
		* 匿名関数
		* アロー関数
		* コンストラクタ
		* メソッド
		* ディスクリプタ
			* ゲッター
			* セッター
		* 各種属性
			* `static`
			* `#`(private)
			* `async`
			* `*`,`yield`
			* `args`
			* `return`
	* Container
		* Array
		* Map/WeakMap
		* Set/WeakSet
		* [TypedArray][](8,16,32,64, Uint/Int/Float/BigInt)
	* Class（`class`構文で作成されたクラス・オブジェクト）
		* ErrorClass
		* Promise
		* Node
		* Elemnet
			* HTMLElement
			* SVGElement
		* RegExp
		* URL
		* Date/Temporal
		* ArrayBuffer/SharedArrayBuffer/DataView/Atomics/JSON/Blob/File
		* Proxy
		* Intl
		* Math/Reflect
	* Instance（`new SomeClass()`で生成されたインスタンス・オブジェクト）
		* ErrorInstance
		* Promise
		* Node
		* Elemnet
			* HTMLElement
			* SVGElement
		* RegExp
		* URL
		* Date/Temporal
		* ArrayBuffer/SharedArrayBuffer/DataView/Atomics/JSON/Blob/File
		* Proxy
		* Intl
		* Math/Reflect

[標準組み込みオブジェクト]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects
[TypedArray]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/TypedArray

以下のように値の確認もしたいが。しかし以下はそれ用の型クラスを作成すれば解決するはず。

```javascript
Value.assert(target, fn);
```
```javascript
Value.assert(target, a=>a.rng(0,100));
Value.assert(target, a=>a.some('A','B','C',null));
```

##### 専用型

* 定数系
    * Three(三値。範囲内(0),範囲外(-1:負方向, 1:正方向))
* 数系
    * Fraction(分数。内部でnumberを2つ持つ)
    * Decimal(十進少数。内部でnumberを2つ持つ)
    * Percent(Decimalの特定書式版)
    * Range(範囲値)
    * Band(帯状範囲値)
    * Random(乱数)
    * Lottery(抽選。バイアス指定乱数)
* 複合系
    * Choices(選択肢。指定値のいずれかと完全一致するはず)
    * Option(存在する場合もあれば存在しない場合もある値)
* 構造系
    * Unique(重複しない配列)
    * Tree(木構造)

```javascript
class Unique {
    static is(ary, name='items') {return this.#validate(ary, name);}
    static #validate(ary, name='items') {
        if (!Array.isArray(ary)) {throw new TypeError(`${name}は配列であるべきです。`)}
        this.throwDuplicates(ary);
    }
    static #throwDuplicates(ary, name='items') {if (this.#hasDuplicates(ary)) {throw new TypeError(`${name}の要素に重複があります。値が重複しないようにしてください。: ${name}:${ary}`)}}
    static #hasDuplicates(ary) {return new Set(ary).size !== ary.length;}
    constructor(...items) {
        this._={items:items};
        Unique.is(items);
    }
    get items() {return [...this._.items]}
}
```
```javascript
class Option {
    static #NONE = Symbol('Option.#NONE');
    constructor(...candidates) {
        this._={candidates:candidates instanceof Unique ? candidates : new Unique(...candidates)};
        this.#validate(candidates.items);
    }
    get items() {return this._.candidates.items}
    has(v) {return Option.#NONE!==this.match(v);}
    match(v, fn) {
        for (let i=0; i<this._.candidates.length; i++) {if(v===this._.candidates[i]){return this.#get(v, fn, i)}}
        return this.#get(Option.#NONE, fn, -1);
    }
    #get(v, fn, i) {return ('function'===typeof fn) ? fn(v,i) : v;}
    #validate(candidates) {
        if (candidates.some(c=>Option.#NONE===c)) {throw new TypeError(`candidatesの要素値にSymbol('Option.#NONE')を指定することはできません。`)};
    }
}
```

`fn`を管理し続けたい場合もありそう。

```javascript
class OptionFn extends Option {
    constructor(candidates, fn) {
        super(candidates);
        this.#validate(fn);
    }
    get items() {return this._.candidates.items}
    has(v) {return Option.#NONE!==this.match(v);}
    match(v, fn) {
        for (let i=0; i<this._.candidates.length; i++) {if(v===this._.candidates[i]){return this.#get(v, fn, i)}}
        return this.#get(Option.#NONE, fn, -1);
    }
    #get(v, fn, i) {return (('function'===typeof fn) ? fn : this._.fn.bind(this))(v,i);}
    #validate(fn) {
        if ('function'!==fn) {throw new TypeError(`fnは関数であるべきです。`)}
        this._.fn = fn;
    }
}
```

選択肢に存在しない場合の挙動を複数(callback,default,Symbol)用意しつつ、コードをDRYに書く。パフォーマンスは犠牲にする。

```javascript
class OptionFn {
    static #NONE = Symbol('OptionFn.#NONE');
    constructor(candidates, fn) {
        this._={candidates:candidates instanceof Unique ? candidates : new Unique(...candidates)};
        this.#validate(candidates.items, fn);
    }
    get items() {return this._.candidates.items}
    has(v) {return Option.#NONE!==this.match(v);}
    match(v, fn) {
        const items = this._.candidates.items;
        for (let i=0; i<items.length; i++) {if(v===items[i]){return this.#get(v, fn, i)}}
        return this.#get(Option.#NONE, fn, -1);
    }
    #get(v, fn, i) {return (('function'===typeof fn) ? fn : this._.fn)(v,i);}
    #validate(candidates, fn) {
        this.#validateCandidates(candidates);
        this.#validateFn(fn);
    }
    #validateCandidates(candidates) {
        if (candidates.some(c=>Option.#NONE===c)) {throw new TypeError(`candidatesの要素値にSymbol('OptionFn.#NONE')を指定することはできません。`)};
    }
    #validateFn(fn) {
        if ('function'!==fn) {throw new TypeError(`fnは関数であるべきです。`)}
        this._.fn = fn;
    }
}
class OptionD extends OptionFn {constructor(candidates, default) {super(candidates, (v,i)=>-1===i ? default : v);}}
class Option extends OptionFn {constructor(...candidates) {super(candidates, (v,i)=>v);}}
```

使い方は以下。

```javascript
const items = 'apple,orange,grapes'.split(',');
const fruits1 = new Option(...items);
fruits1.has('orange');   // true
fruits1.has('banana');   // false
fruits1.match('apple');  // 'apple'
fruits1.match('banana'); // Symbol

const fruits2 = new OptionD(items, '');
fruits2.match('banana'); // ''

const fruits3 = new OptionFn(items, (v,i)=>-1===i ? 'NOTHING!!' : v.toUpperCase());
fruits3.match('apple');  // 'APPLE'
fruits3.match('banana'); // 'NOTHING!!'
```

でもinstanceofがうまくいかないな。全部同じ`Option`で統一したいのだが。

```javascript
fruits1 instanceof Option
fruits2 instanceof OptionFn
fruits3 instanceof OptionD
```

コンストラクタのオーバーロードができれば良かったのだが、できない。仮にできたとしても、三種類(cb,default,symbol)の切り替えをどう判定すべきか。第二引数の型で判断しよう。欠点は`undefined`や関数をデフォルト値にできないこと。

```javascript
class Option {
    static of(...candidates) {
        this.#throw(candidates);
        return new Option(, (v,i)=>v);
    }
    static #throw(candidates) {if (!Array.isArray(candidates)) {throw new TypeError(`candidatesは配列にしてください。`)}}
    static #NONE = Symbol('OptionFn.#NONE');
    constructor(candidates, processor) {
        this._={candidates:candidates instanceof Unique ? candidates : new Unique(candidates)};
        this.#validate(candidates.items, processor);
    }
    get items() {return this._.candidates.items}
    has(v) {return Option.#NONE!==this.match(v);}
    match(v, fn) {
        const items = this._.candidates.items;
        for (let i=0; i<items.length; i++) {if(v===items[i]){return this.#get(v, fn, i)}}
        return this.#get(Option.#NONE, fn, -1);
    }
    #get(v, fn, i) {return (('function'===typeof fn) ? fn : this._.fn)(v,i);}
    #validate(candidates, processor) {
        this.#validateCandidates(candidates);
        this.#validateProcessor(processor);
    }
    #validateCandidates(candidates) {
        Option.#throw(candidates);
        if (candidates.some(c=>Option.#NONE===c)) {throw new TypeError(`candidatesの要素値にSymbol('Option.#NONE')を指定することはできません。`)};
    }
    #validateProcessor(processor) {
        this._.processor = 'function'===processor ? processor : (
            undefined===processor
                ? ((v,i)=>v)
                : ((v,i)=>-1===i ? processor : v));
    }
}
```

使い方は以下。これでinstanceofも同じものを使える。

```javascript
const items = 'apple,orange,grapes'.split(',');
const fruits1 = new Option(items);
fruits1.has('orange');   // true
fruits1.has('banana');   // false
fruits1.match('apple');  // 'apple'
fruits1.match('banana'); // Symbol

const fruits2 = new Option(items, '');
fruits2.match('banana'); // ''

const fruits3 = new Option(items, (v,i)=>-1===i ? 'NOTHING!!' : v.toUpperCase());
fruits3.match('apple');  // 'APPLE'
fruits3.match('banana'); // 'NOTHING!!'

fruits1 instanceof Option
fruits2 instanceof Option
fruits3 instanceof Option
```

可変長引数を使いたいなら`of()`を使う。

```javascript
const fruits4 = Option.of(...items);
fruits1.has('orange');   // true
fruits1.has('banana');   // false
fruits1.match('apple');  // 'apple'
fruits1.match('banana'); // Symbol
```

コンストラクタならば`Unique`インスタンスでもOK。

```javascript
const fruits5 = new Option(new Unique('apple,orange,grapes'.split(',')));
fruits1.has('orange');   // true
fruits1.has('banana');   // false
fruits1.match('apple');  // 'apple'
fruits1.match('banana'); // Symbol
```

##### 複合型チェック

単一の値や型ではなく、複合チェックが必要な場合は以下か。イマイチまとめきれない。

* 範囲
	* 真偽値を返す: `within(target, min, max)`
	* 数を返す:
		* `within(target, min, max)`: -1:超過(-方向), 0:範囲内, 1:超過(+方向)
		* `within(target, min, max)`: [dir,diff] (方向と差分量を返す)
    * 指定値を返す
	* コールバック関数算出値を返す: `within(target, min, max, cb=(dir,diff,t,min,max)=>{...})`
* 選択肢
	* 真偽値を返す: `which(target, ...these)`
	* 指定値を返す: `which(target, [these], default)`
	* コールバック関数算出値を返す`which(target, [these], cb=(is,v)=>{...})`

クラス化すべきかもしれない。

###### 選択肢

```javascript
class Choices {
    constructor(candidates, default) {default:undefined(例外発生)/number(指定candidates(0:最初, -1:最後))
        this._ = {default:default, candidates=candidates}
        this.#validate(candidates, default);
        this.#normalize(candidates, default);
    }
    #hasDuplicates(arr) {return new Set(arr).size !== arr.length;}
    #throwDuplicates(arr) {if (this.#hasDuplicates(arr)) {throw new TypeError(`candidatesに重複があります。値が重複しないようにしてください。`)}}
    #validate(candidates, default) {
        this.#validateCandidates(candidates);
        this.#validateDefault(candidates, default);
    }
    #validateCandidates(candidates) {
        if (!Array.isArray(candidates)) {throw new TypeError(`candidatesは配列にしてください。`)}
        this.throwDuplicates(candidates);
    }
    #validateDefault(candidates, default) {
        if (!(undefined===default || (Number.isInteger(default))) {throw new TypeError(`defaultはundefinedかcandidatesのインデックス値であるべきです。`)}
        this._.default = default + (default<0 ? candidates.length : 0);
        if (candidates.length <= this._.default) {throw new RangeError(`defaultの値がcandidatesの長さを超過しています。: default:${this._.default}, candidates.length:${candidates.length}`)}
    }
    #normalize(candidates, default) {
        if (undefined!==default) {
            const removed = candidates.splice(default, 1);
            this._.default = removed[0];
        }
        if (!this._.candidates.every(c=>c!==this._.default)) {throw new TypeError(`defaultとcandidatesに値の重複があります。重複しないようにしてください。:default:${this._.default, candidates:${this._.candidates}}`)}
    }
    get candidates() {return [...candidates]}
    get default() {return this._.default}
    has(v) {
        for (let c of this._.candidates) {if (c===v) {return true}}
        return false;
    }
    indexOf(v) {
        for (let i=0; i<this._.candidates.length; i++) {if (v===this._.candidates[i]) {return i}}
        return -1;
    }
    match(v) {
        const i = this.indexOf(v);
        return -1===i ? this.#default : this._.candidates[i];
    }
    get #default() {
        if (undefined===this._.default) {throw new TypeError(`値は選択肢に含まれません。`)}
        else {return this._.candidates[this._.default]}
    }
}
```
```javascript
const fruits = new Choices('apple,orange,grapes,'.split(','), -1);
fruits.default; // ''
fruits.candidates; // ['apple','orange','grapes']
fruits.has('orange'); // true
fruits.has(''); // false
fruits.match('apple') // 'apple'
fruits.match('meat') // ''
```

###### 範囲

```javascript
class Range {
	constructor(min, max) {
		this._ = {min, max};
		if (!this.isInt) {throw new TypeError(`min,maxはNumber.isInteger()がtrueを返す値であるべきです。: min:${min}, max:${max}`)}
		if (max <= min) {throw new TypeError(`min < maxであるべきです。: min:${min}, max:${max}`)}
	}
	get min() {return this._.min}
	get max() {return this._.max}
	within(v) {
		if (Number.isInteger(v)) {return this.#withinNum(v)}
		else if (v instanceof Range) {return this.#withinRng(v)}
		else {throw new TypeError(`vはRangeインスタンスかIntegerNumber.isInteger()がtrueを返す値であるべきです。: v:${v}`)}
	}
	#withinNum(v) {return this._.min <= v && v <= this._.max;}
	#withinRng(r) {this._.min<=r.min && r.max<=this._.max}
//	without(v) {return !this.within(v)}
	without(v) {
		if (Number.isInteger(v)) {return this.#withinNum(v)}
		else if (v instanceof Range) {return !this.overlap(v)}
		else {throw new TypeError(`vはRangeインスタンスかIntegerNumber.isInteger()がtrueを返す値であるべきです。: v:${v}`)}
	}
	overlap(r) {// 一部被っている
		this.#throwRng(r, name='r');
		return [r.min, r.max].some(v=>this.#withinNum(v));
	}
	isBeforeOf(r) {return 
		this.#throwRng(r, name='r');
		return r.max < this._.min;
	}
	isAfterOf(r) {
		this.#throwRng(r, name='r');
		return this._.max < r.min;
	}
	isJustBeforeOf(r) {return 
		this.#throwRng(r, name='r');
		return r.max===this._.min+1;
	}
	isJustAfterOf(r) {
		this.#throwRng(r, name='r');
		return this._.max===r.min+1;
	}
	// 0:範囲内, -1:超過(-方向), 1:超過(+方向), 
	dir(v) {return this.within(v) ? 0 : (this.isBeforeOf(v) ? -1 : 1);}
	get width() {return this.#isPos
		? this._.max - this._.min
		: (this.#isNeg
			? (this._.max + this._.min) * -1
			: this.#toPos().reduce((s,v)=>s+v, 1));}
	get #isInt() {return [min,max].every(v=>Number.isInteger(v)}
	get #isPos() {return [min,max].every(v=>0<=v)}
	get #isNeg() {return [min,max].every(v=>v<0)}
	#toPos() {return [min,max].every(v=>v<0 ? v*-1 : v)}
	#throwRng(v, name='r') {if (!(v instanceof Range)) {throw new TypeError(`${name}はRangeインスタンスであるべきです。: ${name}:${v}`)}}

}
```
```javascript
class Band {// 複数の範囲を帯状に持つ
	static NONE = Symbol('範囲外');
	static from(...borders) {// (0, 30, 100)-> [0,30],[31,100]
		if (!(Array.isArray(borders) && 2 < borders.length && borders.every(v=>Number.isInteger(v))) && this.#isSorted(borders)) {throw new TypeError(`bordersは要素数が3以上で整数(Number.isInteger(v)がtrueを返す値)を持った昇順の配列であるべきです。`)}
		const ranges = [];
		for (let i=0; i<borders.length-1; i++) {
			ranges.push(new Range(borders[i] + (0===i ? 0 : 1), borders[i+1]));
		}
		return new Band(new Range(border[0], border[border.length-1]), this.NONE, ranges);
	}
	static #isSorted(arr) {return arr.every((v,i,a)=>i===a.length-1 ? true : v<=a[i+1])}
	constructor(range, default, ...borders) {
		this._ = {range, default, borders};
		if (!(range instanceof Range)) {throw new TypeError(`rangeはRange型であるべきです。`)}
		if (!(Array.isArray(borders) && borders.length<2 && borders.every(b=>b instanceof Range))) {throw new TypeError(`bordersは要素数は2以上のArray<Range>であるべきです。`)}
		// bordersがrange内であること
		if (!(range.min===borders[0].min && range.max===borders[borders.length-1].max)) {throw new TypeError(`bordersがrange外です。bordersはrange内にしてください。`)}
		// bordersの間隔が重複せず差が1であること
		for (let i=0; i<borders.length-1; i++) {
			borders[i].isJustAfterOf(borders[i+1]);
			borders[i+1].isJustBeforeOf(borders[i]);
		}
	}
	get borders() {return this._.borders}
	indexOf(v, i) {
		if (!(Number.isInteger(i) && 0<=i && i<this.borders.length)) {throw new TypeError(`iはbordersのインデックス値であるべきです。`)}
		for (let i=0; i<this._.borders.length; i++) {
			if (this._.borders[i].within(v)) {return i}
		}
		return -1;
	} 
	within(v) {return this._.range.within(v)}
	without(v) {return this._.range.without(v)}
	overlap(r) {return this._.range.overlap(v)}
	contact(r) {return this.isJustBeforeOf(r) || this.isJustAfterOf(r)}
	isBeforeOf(r) {return this._.range.isBeforeOf(v)}
	isAfterOf(r) {return this._.range.isAfterOf(v)}
	isJustBeforeOf(r) {return this._.range.isJustBeforeOf(v)}
	isJustAfterOf(r) {return this._.range.isJustAfterOf(v)}
	get width() {return this._.range.width}
}
```
```javascript
// 3値
class Three {
	static #N = -1;
	static #Z = 0;
	static #P = 1;
	static #valid(v) {
		const vs = [Three.#N,Three.#Z,Three.#P];
		if (!vs.some(V=>V===v)) {throw new TypeError(`不正値です。vは${vs}のいずれかであるべきです。`)}
	}
	static get N() {return new Three(this.#N)}
	static get Z() {return new Three(this.#Z)}
	static get P() {return new Three(this.#P)}
	constructor(v) {// v:number
		Three.#valid(v);
		this._={v:Three.#Z};
		this.v = v;
	}
	get v() {return this._.v}
	set v(V) {this.#throw(v); this._.v=v;}
	get isN() {return Three.#N===this.v}
	get isZ() {return Three.#Z===this.v}
	get isP() {return Three.#P===this.v}
	is(v) {this.#throw(v); return v.v===this.v;}
	#throw(v) {if (!(v instanceof Three)) {throw new TypeError(`vはThreeインスタンスであるべきです。`)}}
}
```


