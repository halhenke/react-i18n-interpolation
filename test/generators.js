import {gen} from 'tape-check';


// testcheck has problems with uniqueness of undefined and null
const undef = {};
const nul = {};
const uniqueFn = v =>
  ((v === undefined) ? undef : (v === null) ? nul : v);


// for our purposes we group null in with the complex values and not the primitives
export const anyPrimitive = gen.primitive;

export const anySymbolOrFunctionRef = gen.oneOf([
  gen.undefined.then(() => Symbol('Symbol')),
  gen.undefined.then(() => (() => undefined))
]);

export const anyEmptyObjectOrArray = gen.oneOf([
  gen.undefined.then(() => ({})),
  gen.undefined.then(() => ([]))
]);

export const anyValue = gen.oneOfWeighted([
  [10, anyPrimitive],
  [1, anySymbolOrFunctionRef],
  [1, anyEmptyObjectOrArray]
]);

export const anyNonEmptyString = gen.asciiString
  .suchThat(v => (v.trim().length > 0));

export const anyEnumerableWithSingleEmptyKey = gen.object({
  '': anyValue
});

export const anyEnumerableWithMultipleKeys = gen.object({
  x: anyValue,
  y: anyValue
});


// pre-generate all the necessary elements to ensure they are unique
export const genUniqueTokens = ({minSize, maxSize}) =>
  gen.intWithin(minSize, maxSize)
    .then(size => gen.object({
      size,
      strings: gen.uniqueArray(anyNonEmptyString, {size: size * 3}),
      values: gen.uniqueArray(anyValue, uniqueFn, {size})
    }))
    .then(({size, strings, values}) => (new Array(size)).fill()
      .map((_, i) => ({
        label: strings[i * 3],
        key: strings[i * 3 + 1],
        name: strings[i * 3 + 2],
        value: values[i]
      }))
    );


// generate some array indices in ascending order
export const genIndices = ({minSize, maxSize}) =>
  ((maxSize < minSize) ?
    gen.undefined.then(() => []) :
    gen.uniqueArray(gen.intWithin(0, maxSize - 1), {minSize, maxSize})
      .then(arr => arr.sort()));


// take the elements of some array and group them into N nested arrays, by grouping each Nth element
// cull any groups that are less than 2 elements
export const groupElements = ({maxGroups}) => array =>
  gen.intWithin(1, maxGroups)
    .then(numGroups => array
      .reduce(
        (groups, element, i) => {
          groups[i % numGroups].push(element);
          return groups;
        },
        (new Array(numGroups)).fill().map(() => [])
      )
      .filter(group => (group.length > 1))
    );


export const genGroupedIndicesForTokens = ({maxGroups}) => uniqueTokens =>
  gen.object({
    uniqueTokens,
    groupedIndices: genIndices({minSize: 0, maxSize: uniqueTokens.length})
      .then(groupElements({maxGroups}))
  });
