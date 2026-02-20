import { describe, it, expect } from 'vitest';
import { moneyRound, moneyAdd } from '../../src/core/money.js';

describe('money core', () => {
  it('moneyRound rounds correctly', () => {
    expect(moneyRound(1.005)).toBe(1.01);
  });

  it('moneyAdd avoids floating glitches', () => {
    expect(moneyAdd(0.1, 0.2)).toBe(0.3);
  });
});
