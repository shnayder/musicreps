// Framework-level tests for comparison strategies used by the answer spec.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkCorrectness, toButtonValue } from './answer-utils.ts';

// ---------------------------------------------------------------------------
// checkCorrectness
// ---------------------------------------------------------------------------

describe('checkCorrectness — exact', () => {
  it('matches identical strings', () => {
    assert.equal(checkCorrectness('exact', 'IV', 'IV'), true);
  });

  it('rejects different case', () => {
    assert.equal(checkCorrectness('exact', 'IV', 'iv'), false);
  });

  it('rejects different string', () => {
    assert.equal(checkCorrectness('exact', '2#', '3#'), false);
  });
});

describe('checkCorrectness — integer', () => {
  it('matches same integer', () => {
    assert.equal(checkCorrectness('integer', '5', '5'), true);
  });

  it('matches with leading zeros', () => {
    assert.equal(checkCorrectness('integer', '05', '5'), true);
  });

  it('rejects different number', () => {
    assert.equal(checkCorrectness('integer', '5', '6'), false);
  });
});

describe('checkCorrectness — note-enharmonic', () => {
  it('matches same note', () => {
    assert.equal(checkCorrectness('note-enharmonic', 'Eb', 'Eb'), true);
  });

  it('matches lowercase input', () => {
    assert.equal(checkCorrectness('note-enharmonic', 'Eb', 'eb'), true);
  });

  it('matches enharmonic equivalent', () => {
    assert.equal(checkCorrectness('note-enharmonic', 'Eb', 'D#'), true);
  });

  it('matches s→# alias notation for sharp', () => {
    assert.equal(checkCorrectness('note-enharmonic', 'Eb', 'ds'), true);
  });

  it('rejects different pitch', () => {
    assert.equal(checkCorrectness('note-enharmonic', 'Eb', 'E'), false);
  });
});

describe('checkCorrectness — interval', () => {
  it('matches primary abbreviation', () => {
    assert.equal(checkCorrectness('interval', 'P5', 'P5'), true);
  });

  it('rejects different interval', () => {
    assert.equal(checkCorrectness('interval', 'P5', 'm6'), false);
  });

  it('matches alt abbreviation for tritone', () => {
    assert.equal(checkCorrectness('interval', 'TT', 'A4'), true);
    assert.equal(checkCorrectness('interval', 'TT', 'd5'), true);
  });

  it('rejects non-matching input', () => {
    assert.equal(checkCorrectness('interval', 'TT', 'P4'), false);
  });
});

// ---------------------------------------------------------------------------
// toButtonValue
// ---------------------------------------------------------------------------

describe('toButtonValue', () => {
  it('note-enharmonic resolves flat to sharp canonical', () => {
    assert.equal(toButtonValue('note-enharmonic', 'Eb'), 'D#');
  });

  it('note-enharmonic keeps natural note unchanged', () => {
    assert.equal(toButtonValue('note-enharmonic', 'C'), 'C');
  });

  it('note-enharmonic maps double sharps to enharmonic natural', () => {
    assert.equal(toButtonValue('note-enharmonic', 'F##'), 'G');
    assert.equal(toButtonValue('note-enharmonic', 'C##'), 'D');
  });

  it('note-enharmonic maps double flats to enharmonic natural', () => {
    assert.equal(toButtonValue('note-enharmonic', 'Ebb'), 'D');
    assert.equal(toButtonValue('note-enharmonic', 'Dbb'), 'C');
  });

  it('exact passes through unchanged', () => {
    assert.equal(toButtonValue('exact', 'IV'), 'IV');
  });

  it('integer passes through unchanged', () => {
    assert.equal(toButtonValue('integer', '5'), '5');
  });

  it('interval passes through unchanged', () => {
    assert.equal(toButtonValue('interval', 'P5'), 'P5');
  });
});
