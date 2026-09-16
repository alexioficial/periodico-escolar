import assert from 'node:assert/strict';
import test from 'node:test';
import {
	getPublicRateLimitPolicy,
	shouldApplyPublicRateLimit
} from '../src/lib/server/publicRateLimit.ts';

test('limita únicamente lecturas públicas que consultan datos', () => {
	assert.equal(getPublicRateLimitPolicy('/api/feed')?.scope, 'public-feed-api');
	assert.equal(getPublicRateLimitPolicy('/feed')?.scope, 'public-pages');
	assert.equal(getPublicRateLimitPolicy('/post/507f1f77bcf86cd799439011')?.scope, 'public-pages');
	assert.equal(getPublicRateLimitPolicy('/login/507f1f77bcf86cd799439011'), null);
	assert.equal(getPublicRateLimitPolicy('/login/not-an-id'), null);
	assert.equal(getPublicRateLimitPolicy('/login')?.scope, 'public-auth-pages');
	assert.equal(getPublicRateLimitPolicy('/auth/login'), null);
	assert.equal(getPublicRateLimitPolicy('/auth/m/token')?.scope, 'public-auth-pages');
	assert.equal(getPublicRateLimitPolicy('/auth/google')?.scope, 'public-auth-pages');
	assert.equal(getPublicRateLimitPolicy('/auth/google/callback')?.scope, 'public-auth-pages');
	assert.equal(getPublicRateLimitPolicy('/api/auth/magic-link'), null);
});

test('limita autenticación pública y detalles incluso con sesión iniciada', () => {
	assert.equal(shouldApplyPublicRateLimit('GET', '/login', true), true);
	assert.equal(shouldApplyPublicRateLimit('GET', '/auth/google', true), true);
	assert.equal(shouldApplyPublicRateLimit('GET', '/post/507f1f77bcf86cd799439011', true), true);
	assert.equal(shouldApplyPublicRateLimit('GET', '/feed', true), false);
	assert.equal(shouldApplyPublicRateLimit('GET', '/feed', false), true);
	assert.equal(shouldApplyPublicRateLimit('POST', '/post/507f1f77bcf86cd799439011', true), false);
});
