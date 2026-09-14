import assert from 'node:assert/strict';
import test from 'node:test';
import { getPublicRateLimitPolicy } from '../src/lib/server/publicRateLimit.ts';

test('limita únicamente lecturas públicas que consultan datos', () => {
	assert.equal(getPublicRateLimitPolicy('/api/feed')?.scope, 'public-feed-api');
	assert.equal(getPublicRateLimitPolicy('/feed')?.scope, 'public-pages');
	assert.equal(getPublicRateLimitPolicy('/post/507f1f77bcf86cd799439011')?.scope, 'public-pages');
	assert.equal(getPublicRateLimitPolicy('/login/507f1f77bcf86cd799439011')?.scope, 'direct-login');
	assert.equal(getPublicRateLimitPolicy('/login/not-an-id'), null);
	assert.equal(getPublicRateLimitPolicy('/login'), null);
	assert.equal(getPublicRateLimitPolicy('/auth/login'), null);
	assert.equal(getPublicRateLimitPolicy('/auth/m/token'), null);
	assert.equal(getPublicRateLimitPolicy('/auth/google'), null);
	assert.equal(getPublicRateLimitPolicy('/api/auth/magic-link'), null);
});
