import assert from 'node:assert/strict';
import test from 'node:test';
import { getPublicRateLimitPolicy } from '../src/lib/server/publicRateLimit.ts';

test('limita únicamente lecturas públicas que consultan datos', () => {
	assert.equal(getPublicRateLimitPolicy('/api/feed')?.scope, 'public-feed-api');
	assert.equal(getPublicRateLimitPolicy('/feed')?.scope, 'public-pages');
	assert.equal(getPublicRateLimitPolicy('/post/507f1f77bcf86cd799439011')?.scope, 'public-pages');
	assert.equal(getPublicRateLimitPolicy('/auth/login')?.scope, 'public-auth-pages');
	assert.equal(getPublicRateLimitPolicy('/auth/m/token')?.scope, 'public-auth-pages');
	assert.equal(getPublicRateLimitPolicy('/auth/google')?.scope, 'public-oauth');
	assert.equal(getPublicRateLimitPolicy('/auth/google/callback')?.scope, 'public-oauth');
	assert.equal(getPublicRateLimitPolicy('/api/auth/magic-link'), null);
});
