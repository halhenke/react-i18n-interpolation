import test from 'tape';
import sinon from 'sinon';
import React from 'react';
import {check, gen} from 'tape-check';

import {times} from './helpers';
import {
  anyPrimitive, anyNonEmptyString, anyEmptyObjectOrArray, anySymbolOrFunctionRef,
  anyEnumerableWithSingleEmptyKey, anyEnumerableWithMultipleKeys,
  genIndices
} from './generators';
import {
  genTokensWithDuplicateNames
} from './token-spec';

import {gettextFactory} from '../src/index';


const createSpy = () => {
  const spy = sinon.spy();
  const gettext = (text) => {
    spy(text);
    return text;
  };

  return {spy, gettext: {gettext}};
};

const anyUnkeyedComplexSubstitution = gen.oneOf([
  anySymbolOrFunctionRef,
  anyEmptyObjectOrArray,
  anyEnumerableWithSingleEmptyKey,
  anyEnumerableWithMultipleKeys
]);

const anyKeyedPrimitiveSubstitutionKV = gen.object({
  k: anyNonEmptyString,
  v: anyPrimitive
});

const anyKeyedComplexSubstitutionKV = gen.object({
  k: anyNonEmptyString,
  v: gen.oneOf([anySymbolOrFunctionRef, anyEmptyObjectOrArray])
});

const anyObjectLikeSubstitution = anyKeyedComplexSubstitutionKV
  .then(({k, v}) => ({[k]: v}));

const anyStringLikeSubstitution = gen.oneOf([
  anyPrimitive,
  anyUnkeyedComplexSubstitution,
  anyKeyedPrimitiveSubstitutionKV.then(({k, v}) => ({[k]: v}))
]);


const genMixOfStringAndObjectSubstitutions = ({size}) =>
  gen.object({
    objIndices: genIndices({minSize: 0, maxSize: size}),
    objLikeSubstitutions: gen.array(anyObjectLikeSubstitution, {size}),
    strLikeSubstitutions: gen.array(anyStringLikeSubstitution, {size})
  })
    .then(({objIndices, objLikeSubstitutions, strLikeSubstitutions}) => {
      const objectPool = objLikeSubstitutions.slice();
      const stringPool = strLikeSubstitutions.slice();
      const values = (new Array(size)).fill()
        .map((_, i) => (objIndices.includes(i) ? objectPool.pop() : stringPool.pop()));
      return {objIndices, values};
    });


test('gettext: created with bad gettext instance', (t) => {
  const template = gettextFactory({NODE_ENV: 'development', gettext: {}});

  t.throws(
    () => template`foo`,
    /missing gettext/,
    'should throw an Error'
  );
  t.end();
});


test('gettext: degenerate case without substitutions', (t) => {
  const {spy, gettext} = createSpy();
  const template = gettextFactory({gettext});

  t.equal(
    template`foo`,
    'foo',
    'should behave transparently'
  );
  t.equal(
    spy.firstCall.args[0],
    'foo',
    'should go through translation'
  );
  t.end();
});


test('gettext: direct primitive substitutions', check(
  times(20),
  anyPrimitive,
  (t, v) => {
    const {spy, gettext} = createSpy();
    const template = gettextFactory({gettext});

    t.equal(
      template`foo ${v}`,
      `foo ${String(v)}`, /* Symbol needs explicit string conversion */
      'should return string'
    );
    t.equal(
      spy.firstCall.args[0],
      `foo ${String(v)}`,
      'should substitute before translation'
    );
    t.end();
  }
));


test('gettext: direct complex substitution', check(
  times(20),
  anyUnkeyedComplexSubstitution,
  (t, v) => {
    const {spy, gettext} = createSpy();
    const devTemplate = gettextFactory({gettext, NODE_ENV: 'development'});

    t.throws(
      () => devTemplate`foo ${v}`,
      /Error in gettext/,
      'should throw exception in development env'
    );
    t.notOk(
      spy.called,
      'should throw before translation'
    );

    const prodTemplate = gettextFactory({gettext, NODE_ENV: 'production'});

    t.doesNotThrow(
      () => prodTemplate`foo ${v}`,
      'should not throw exception in production env'
    );
    t.equal(
      prodTemplate`foo ${v}`,
      `foo ${String(v)}`, /* Symbol needs explicit string conversion */
      'in production should return string'
    );
    t.equal(
      spy.firstCall.args[0],
      `foo ${String(v)}`,
      'should substitute before translation'
    );

    t.end();
  }
));


test('gettext: keyed primitive substitution', check(
  times(20),
  anyKeyedPrimitiveSubstitutionKV,
  (t, {k, v}) => {
    const {spy, gettext} = createSpy();
    const template = gettextFactory({gettext});

    t.equal(
      template`foo ${{[k]: v}}`,
      `foo ${String(v)}`, /* Symbol needs explicit string conversion */
      'should return string'
    );
    t.equal(
      spy.firstCall.args[0],
      `foo __${k}__`, /* this is white-box but we need to check translation somehow */
      'should use token name in the translation'
    );
    t.end();
  }
));


test('gettext: keyed complex substitution', check(
  times(20),
  anyKeyedComplexSubstitutionKV,
  (t, {k, v}) => {
    const {spy, gettext} = createSpy();
    const template = gettextFactory({gettext});

    t.deepEqual(
      template`foo ${{[k]: v}}`,
      ['foo ', v],
      'should return Array'
    );
    t.equal(
      spy.firstCall.args[0],
      `foo __${k}__`, /* this is white-box but we need to check translation somehow */
      'should use token name in the translation'
    );
    t.end();
  }
));


test('gettext: mix of keyed and non-keyed substitutions', check(
  times(20),
  genMixOfStringAndObjectSubstitutions({size: 3}),
  (t, {objIndices, values: [v1, v2, v3]}) => {
    const template = gettextFactory({NODE_ENV: 'production'});
    const result = template`1${v1}2${v2}${v3}3`;

    t.ok(
      objIndices.length ? Array.isArray(result) : (typeof result === 'string'),
      'should return string where there is full string collapse or Array otherwise'
    );
    t.equal(
      [].concat(result).length,
      1 + objIndices.length * 2 - Number(objIndices.includes(1) && (objIndices.includes(2))),
      'should collapse all primitive substitutions into fewer strings'
    );
    t.end();
  }
));


test('gettext: keyed substitution with duplicate names', check(
  times(20),
  genTokensWithDuplicateNames, /* all tokens throw, but for some it is because they are unkeyed */
  (t, {tokens}) => {
    const {spy, gettext} = createSpy();
    const devTemplate = gettextFactory({gettext, NODE_ENV: 'development'});

    t.throws(
      () => devTemplate((new Array(tokens.length + 1)).fill(''), ...tokens),
      /Error in gettext/,
      'should throw exception in development env'
    );
    t.notOk(
      spy.called,
      'should throw before translation'
    );

    const prodTemplate = gettextFactory({gettext, NODE_ENV: 'production'});

    t.doesNotThrow(
      () => prodTemplate((new Array(tokens.length + 1)).fill(''), ...tokens),
      'should not throw exception in development env'
    );
    t.end();
  }
));


test('gettext: keyed React element substitution', (t) => {
  const template = gettextFactory();

  const unkeyedElement = React.createElement('span', {foo: 'bar'});
  const unkeyedResult = template`foo ${{a: unkeyedElement}}`;

  t.ok(
    React.isValidElement(unkeyedResult[1]),
    'should maintain valid react elements'
  );

  t.notEqual(
    unkeyedResult[1],
    unkeyedElement,
    'should clone the element where key is missing'
  );

  t.deepLooseEqual(
    [
      template`foo ${{a: unkeyedElement}}`,
      template`${{b: unkeyedElement}} bar`
    ], [
      ['foo ', {...unkeyedElement, key: 'a-1'}],
      [{...unkeyedElement, key: 'b-0'}, ' bar']
    ],
    'should generate an element key where key is missing'
  );

  const keyedElement = React.createElement('span', {foo: 'bar', key: 'baz'});
  const keyedResult = template`foo ${{a: keyedElement}}`;

  t.equal(
    keyedResult[1],
    keyedElement,
    'should not clone the element where key is present'
  );

  t.looseEqual(
    keyedResult[1],
    {...keyedElement, key: 'baz'},
    'should not overwrite element key where key is present'
  );

  t.end();
});
