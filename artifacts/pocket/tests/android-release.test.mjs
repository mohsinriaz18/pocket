import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  releaseConfig, validatePublicConfig, decodeKeystore, requireValues, attachSigningConfig,
} from '../scripts/prepare-android-release.mjs';

const config = {
  expo: { version: '1.0.0', android: { package: 'com.pocketwealth.app', permissions: ['android.permission.INTERNET'] } },
};
const publicConfig = () => ({
  EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_test-only',
  EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'goog_test-only',
});

test('version codes are validated and never interpolate executable input', () => {
  for (const value of ['', '0', '-1', '1.5', '1; echo hello', '2147483647', '1e3', undefined]) {
    assert.throws(() => releaseConfig(config, value));
  }
  assert.equal(releaseConfig(config, '42').expo.android.versionCode, 42);
  assert.equal(config.expo.android.versionCode, undefined);
});
test('release keeps the confirmed app identity and billing permission', () => {
  const result = releaseConfig(config, '1');
  assert.equal(result.expo.android.package, 'com.pocketwealth.app');
  assert.ok(result.expo.android.permissions.includes('com.android.vending.BILLING'));
  assert.ok(result.expo.android.permissions.includes('android.permission.INTERNET'));
  assert.equal(releaseConfig(result, '2').expo.android.permissions.length, 2);
  assert.throws(() => releaseConfig({ expo: { android: { package: 'different.app' } } }, '1'));
});
test('mobile config rejects private Supabase and RevenueCat credentials', () => {
  assert.doesNotThrow(() => validatePublicConfig(publicConfig()));
  const anonJwt = `header.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.signature`;
  assert.doesNotThrow(() => validatePublicConfig({ ...publicConfig(), EXPO_PUBLIC_SUPABASE_ANON_KEY: anonJwt }));
  for (const key of ['sb_secret_test-only', 'invalid', `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`]) {
    assert.throws(() => validatePublicConfig({ ...publicConfig(), EXPO_PUBLIC_SUPABASE_ANON_KEY: key }));
  }
  assert.throws(() => validatePublicConfig({ ...publicConfig(), EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'sk_test-only' }));
  assert.throws(() => validatePublicConfig({ ...publicConfig(), EXPO_PUBLIC_SUPABASE_URL: 'http://example.com' }));
});
test('missing configuration errors report names, not provided values', () => {
  assert.throws(() => requireValues({ existing: 'test-only' }, ['existing', 'missing']), { message: 'Missing configuration: missing' });
});
test('keystore decoding rejects malformed or empty inputs', () => {
  for (const value of ['', '%%%', 'YQ==', 'abcd=']) assert.throws(() => decodeKeystore(value));
  const bytes = Buffer.alloc(256, 1);
  assert.deepEqual(decodeKeystore(bytes.toString('base64')), bytes);
  assert.deepEqual(decodeKeystore(bytes.toString('base64').match(/.{1,20}/g).join('\n')), bytes);
});
test('native signing directive is attached once and targets the app script', () => {
  const folder = mkdtempSync(join(tmpdir(), 'pocket-signing-test-'));
  try {
    const file = join(folder, 'build.gradle');
    writeFileSync(file, 'android { buildTypes { release {} } }\n');
    attachSigningConfig(file);
    attachSigningConfig(file);
    assert.equal(readFileSync(file, 'utf8').match(/apply from:/g).length, 1);
    assert.ok(readFileSync(file, 'utf8').includes("../../scripts/android-signing.gradle"));
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
