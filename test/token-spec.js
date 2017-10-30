import test from 'tape';
import {check, gen} from 'tape-check';

import {times, safeIsNaN} from './helpers';
import {
  anyValue, anyNonEmptyString, anyEnumerableWithSingleEmptyKey, anyEnumerableWithMultipleKeys,
  genUniqueTokens, genGroupedIndicesForTokens
} from './generators';

import {defaultToToken, calculateCollisions} from '../src/token';


// adjust the tokens for each of the groups so that there are duplicates based on the first token
// in the group
const createDuplicatesIn = field => ({uniqueTokens, groupedIndices, ...rest}) => ({
  ...rest,
  uniqueTokens,
  groupedIndices,
  tokens: uniqueTokens.map((token, i) => {
    const j = groupedIndices.findIndex(indices => indices.includes(i));
    const reference = (j in groupedIndices) && uniqueTokens[groupedIndices[j][0]] || token;
    return {...token, [field]: reference[field]};
  })
});


test('token parsing: direct substitutions or invalid keyed substitutions', check(
  times(50),
  gen.object({
    substitution: gen.oneOfWeighted([
      [10, anyValue],
      [1, anyEnumerableWithSingleEmptyKey],
      [1, anyEnumerableWithMultipleKeys]
    ]),
    i: gen.intWithin(0, 10)
  }),
  (t, {substitution, i}) => {
    const {key, label, name, value} = defaultToToken(substitution, i);

    t.equal(key, undefined, 'key should be undefined');
    t.ok(label.includes(String(i)), 'label should include the given index');
    t.equal(name, String(substitution), 'name should be the substitution cast to string');
    t.equal(value, String(substitution), 'value should be the substitution cast to string');
    t.end();
  }
));


test('token parsing: valid keyed substitutions', check(
  times(50),
  gen.object({
    k: anyNonEmptyString,
    v: anyValue,
    i: gen.intWithin(0, 10)
  }),
  (t, {k, v, i}) => {
    const {key, label, name, value} = defaultToToken({[k]: v}, i);

    t.equal(key, k, 'key is as specified');
    t.ok(label.includes(String(i)), 'label is something that includes the index');
    t.ok(label.includes(k), 'label is something that includes the key');
    t.ok(name.includes(k), 'name is something that includes the key');

    if (safeIsNaN(v)) {
      t.ok(safeIsNaN(value), 'value should be as specified');
    } else {
      t.equal(value, v, 'value should be as specified');
    }

    t.end();
  }
));


export const genTokensWithDuplicateValues =
  genUniqueTokens({minSize: 2, maxSize: 9})
    .then(genGroupedIndicesForTokens({maxGroups: 3}))
    .then(createDuplicatesIn('value'));

test('token validation: duplicate values', check(
  times(50),
  genTokensWithDuplicateValues,
  (t, {tokens}) => {
    t.deepEqual(
      calculateCollisions(tokens),
      [],
      'should allow duplicate values unconditionally'
    );
    t.end();
  }
));


export const genTokensWithDuplicateNames =
  genUniqueTokens({minSize: 2, maxSize: 9})
    .then(genGroupedIndicesForTokens({maxGroups: 3}))
    .then(createDuplicatesIn('name'))
    .then(({tokens, groupedIndices, ...rest}) => ({
      ...rest,
      tokens,
      groupedLabels: groupedIndices.map(indices => tokens
        .filter((_, i) => indices.includes(i))
        .map(({label}) => label)
      )
    }));

test('token validation: duplicate names', check(
  times(50),
  genTokensWithDuplicateNames,
  (t, {tokens, groupedLabels}) => {
    t.deepEqual(
      calculateCollisions(tokens),
      groupedLabels.map(labels => labels.join(' vs ')),
      'should disallow same name different value, and identify all such sets by label'
    );
    t.end();
  }
));
