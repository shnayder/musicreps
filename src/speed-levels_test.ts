import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { getSpeedLevel, speedColorToken, speedLabel } from './speed-levels.ts';

describe('getSpeedLevel', () => {
  it('returns automatic for >= 0.9', () => {
    assert.equal(getSpeedLevel(0.9).key, 'automatic');
    assert.equal(getSpeedLevel(1.0).key, 'automatic');
  });

  it('returns solid for >= 0.7', () => {
    assert.equal(getSpeedLevel(0.7).key, 'solid');
    assert.equal(getSpeedLevel(0.89).key, 'solid');
  });

  it('returns learning for >= 0.3', () => {
    assert.equal(getSpeedLevel(0.3).key, 'learning');
    assert.equal(getSpeedLevel(0.69).key, 'learning');
  });

  it('returns hesitant for > 0 and < 0.3', () => {
    assert.equal(getSpeedLevel(0.01).key, 'hesitant');
    assert.equal(getSpeedLevel(0.29).key, 'hesitant');
  });

  it('returns starting for 0', () => {
    assert.equal(getSpeedLevel(0).key, 'starting');
  });

  it('returns starting for negative values', () => {
    assert.equal(getSpeedLevel(-1).key, 'starting');
  });
});

describe('speedLabel', () => {
  it('returns label strings', () => {
    assert.equal(speedLabel(0.95), 'Automatic');
    assert.equal(speedLabel(0.75), 'Solid');
    assert.equal(speedLabel(0.5), 'Learning');
    assert.equal(speedLabel(0.1), 'Hesitant');
    assert.equal(speedLabel(0), 'Starting');
  });
});

describe('speedColorToken', () => {
  it('returns heatmap CSS tokens', () => {
    assert.equal(speedColorToken(0.95), '--heatmap-5');
    assert.equal(speedColorToken(0.75), '--heatmap-4');
    assert.equal(speedColorToken(0.5), '--heatmap-3');
    assert.equal(speedColorToken(0.1), '--heatmap-2');
    assert.equal(speedColorToken(0), '--heatmap-1');
  });
});
