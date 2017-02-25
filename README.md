# react-i18n-interpolation

String interpolation of translated text and React components.

Intended for [gettext](https://www.npmjs.com/search?q=gettext) or similar translation APIs (where the key is the intended text in the developer's locale).

## Concept

### Tagged Template Literals

This library provides custom [Tagged Template Literals](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Template_literals#Tagged_template_literals) interpolation functions.

```javascript
tag = (template, ...substitutions) => ...

tag`Some statement that can use ${substitution}`
```

Template Literals allow **substitutions**. These will appear as wildcards in the untranslated text.

```
msgid "Some statement that can use ____"
msgstr ...
```

### React

Consider a React `Paginator` component where `More` and `Less` anchors will allow more or fewer results to be shown.

```html
<span>Show <a>10 More</a> or <a>5 Less</a></span>
```

The anchors themselves would need to be separate HTML elements, nested in the overall statement. And the number of more or less items may vary. So it is reasonable to assume they would be nested React components.

In a perfect world we could use a **Tagged Template Literal** to compose idiomatically.

```
<span>
  {tag`Show
    ${<More key="more" {...{numMore, onMore}} />} or
    ${<Less key="less" {...{numLess, onLess}} />}`}
</span>
```

Presumably we will translate the `<More/>` and `<Less/>` components separately. But we still need the overall translation to look sensible, such as:

```
msgid "Show __more__ or __less__"
msgstr ...
```

Happily we can achieve this if we allow our interpolator function to return `Array` in the case that any substitution is non-string (i.e. a React element). React can then treat this array as `{children}`.

So long as all substitutions must have a `key` React is happy.

These `key`s futher allow sensible tokens in our translation string. In the example above, the `__more__` and `__less__` tokens come from the respective `key` of the `More` and `Less` elements. 

## Usage

### Installation

Install the package

```bash
$ npm install --save react-i18-interpolation
```

Choose a translation package, for example [node-gettext](https://www.npmjs.com/search?q=gettext).

```bash
$ npm install --save node-gettext
```

### Setup

Setup in your application.

```javascript
import NodeGettext from 'node-gettext';
import {gettextFactory, ngettextFactory} from 'react-i18-interpolation';

const nodeGettext = new NodeGettext();
nodeGettext.addTextdomain(...);
nodeGettext.textdomain(...);
  
const gettext = gettextFactory(nodeGettext.gettext);
const ngettext = ngettextFactory(nodeGettext.gettext);
```

We recommend you distribute these method(s) to components by `redux`, or failing that but `context`. Using `redux` allows your UI to respond to changes in text domain real-time.


### API

#### gettext

The simple form is `gettext`.

It is used directly as a Tag.

```javascript
gettext`Some statement`
```

#### ngettext

The plural-capable form is `ngettext`.

This is a function where the only argument is the `condition`. The result of the function call is used as a Tag.

```javascript
ngettext(condition)`Singular statement|Plural statement`
```

Think of the `condition` as the **quantity** in your plural statement.

The template needs to have pipe-delimited `singular|plural` forms. The singular form is used where `condition === 1`, and the plural form is used otherwise.

Substitutions must be made explicitly (the quantity is not added automatically).

There must be exactly one delimiter, and the translation must preserve it, or else an `Error` will be thrown.

#### advanced (generalised) usage

For `ngettext` you may alternatively pass `condition` as a function of the untranslated text `string`. It should return an integer `index`. 

```javascript
condition: (untranslated:string) => number
```

With a `condition` of this form you are permitted **any number** of pipe-delimited forms in the template. Where only one is selected by the zero-based `index`.

There must be a sufficient number of delimited forms to satisfy any given `index`, or an (out-of-bounds) `Error` will be thrown.

The translation must also preserve the number of delimiters or an `Error` will be thrown.

## Example

Here is our paginator example.

```javascript
import {gettextDefault} from 'react-i18-interpolation';

export const Paginator = ({numMore, onMore, numLess, onLess, gettext}) => (
  <span>
    {gettext`Show
      ${<More key="more" {...{numMore, onMore}} />} or
      ${<Less key="less" {...{numLess, onLess}} />}`}
  </span>
);

Paginator.propTypes = {
  ...,
  gettext: React.PropTypes.func
};

Paginator.defaultProps = {
  gettext: gettextDefault
};
```

Don't be confused by the `react-i18-interpolation` import. This only gives us the default (degenerate) implementation. Which you can choose to omit anyhow.

As stated above, where translation is available it is best distributed through `redux`.

The `More` and `Less` components will need the plural-capable form `ngettext`.

```javascript
import {ngettextDefault} from 'react-i18-interpolation';

export const More = ({numMore, onMore, ngettext}) => (
  <a onClick={onMore}>
    {ngettext(numMore)`Show one more|Show ${numMore} more`}
  </a>
);

More.propTypes = {
  ...,
  ngettext: React.PropTypes.func
};

More.defaultProps = {
  ngettext: ngettextDefault
};
```

In this case the substitution is not a React element, so the token will not be descriptive.

```
msgid "Show one more|Show ___ more"
msgstr ...
```
