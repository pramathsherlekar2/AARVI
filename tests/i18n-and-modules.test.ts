import assert from 'node:assert/strict';
import test from 'node:test';
import {AARVI_16_MODULES, AARVI_20_MODULES} from '../src/data/aarviSeed.ts';
import {en} from '../src/i18n/locales/en.ts';
import {hi} from '../src/i18n/locales/hi.ts';
import {kn} from '../src/i18n/locales/kn.ts';
import {mr} from '../src/i18n/locales/mr.ts';
import {ta} from '../src/i18n/locales/ta.ts';
import {te} from '../src/i18n/locales/te.ts';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') {
      out[key] = v;
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenKeys(v as Record<string, unknown>, key));
    }
  }
  return out;
}

function extractPlaceholders(str: string): string[] {
  return Array.from(str.matchAll(/\{\{(\w+)\}\}/g))
    .map((m) => m[1])
    .sort();
}

test('All 6 languages have 100% key parity, non-empty strings, and matching interpolation placeholders', () => {
  const enFlat = flattenKeys(en as unknown as Record<string, unknown>);
  const locales: Array<[string, Record<string, unknown>]> = [
    ['hi', hi as unknown as Record<string, unknown>],
    ['mr', mr as unknown as Record<string, unknown>],
    ['ta', ta as unknown as Record<string, unknown>],
    ['te', te as unknown as Record<string, unknown>],
    ['kn', kn as unknown as Record<string, unknown>],
  ];

  const enKeys = Object.keys(enFlat).sort();
  assert.ok(enKeys.length > 250, 'Expected full translation catalog');

  for (const [key, val] of Object.entries(enFlat)) {
    assert.ok(val.trim().length > 0, `en.${key} must not be empty`);
  }

  for (const [code, localeObj] of locales) {
    const flat = flattenKeys(localeObj);
    const keys = Object.keys(flat).sort();
    assert.deepEqual(keys, enKeys, `Locale ${code} keys must match en keys exactly`);

    for (const key of enKeys) {
      assert.ok(flat[key].trim().length > 0, `${code}.${key} must not be empty`);
      assert.deepEqual(
        extractPlaceholders(flat[key]),
        extractPlaceholders(enFlat[key]),
        `Interpolation placeholders mismatch at ${code}.${key}`,
      );
    }
  }
});

test('Module registry preserves all 16 original modules and registers all 20 unique modules', () => {
  assert.equal(AARVI_16_MODULES.length, 16);
  assert.equal(AARVI_20_MODULES.length, 20);

  const ids = new Set(AARVI_20_MODULES.map((m) => m.id));
  const slugs = new Set(AARVI_20_MODULES.map((m) => m.slug));
  assert.equal(ids.size, 20);
  assert.equal(slugs.size, 20);

  // Every original module 1-16 stays intact at the start of AARVI_20_MODULES
  for (let i = 0; i < 16; i += 1) {
    assert.equal(AARVI_20_MODULES[i].id, AARVI_16_MODULES[i].id);
    assert.equal(AARVI_20_MODULES[i].slug, AARVI_16_MODULES[i].slug);
  }

  const enFlat = flattenKeys(en as unknown as Record<string, unknown>);
  for (const mod of AARVI_20_MODULES) {
    assert.ok(enFlat[mod.titleKey], `Missing titleKey ${mod.titleKey}`);
    assert.ok(enFlat[mod.summaryKey], `Missing summaryKey ${mod.summaryKey}`);
  }
});
