import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId } from 'mongodb';
import type { CoreRateLimitOptions, RateLimitResult } from '../src/lib/server/rateLimitCore.ts';
import {
	normalizeSafeUrl,
	normalizeTrustedDomain,
	getTrustedDomainFromUrl,
	sanitizeTrustedDomains,
	isTrustedUrl
} from '../src/lib/trustedDomains.ts';
import { mutateTrustedDomainInCollection } from '../src/lib/server/trustedDomains.ts';
import { handleTrustedDomainMutation } from '../src/lib/server/trustedDomainRequest.ts';

test('normalizes HTTP URLs and exact ASCII hostnames without extending trust', () => {
	assert.equal(normalizeSafeUrl('HTTPS://EXAMPLE.COM:443/a?q=1#b'), 'https://example.com/a?q=1#b');
	assert.equal(normalizeSafeUrl('/noticias?a=1'), '/noticias?a=1');
	assert.equal(normalizeTrustedDomain('EXAMPLE.COM.'), 'example.com');
	assert.equal(getTrustedDomainFromUrl('https://EXAMPLE.com:8443/a?q=1'), 'example.com');
	assert.equal(getTrustedDomainFromUrl('https://mañana.example/a'), 'xn--maana-pta.example');
	assert.equal(isTrustedUrl('https://example.com/a', ['example.com']), true);
	assert.equal(isTrustedUrl('/noticias', []), true);
	assert.equal(isTrustedUrl('https://sub.example.com/a', ['example.com']), false);
	assert.equal(isTrustedUrl('https://example.com.evil.test/a', ['example.com']), false);
});

test('rejects unsafe or oversized URLs before browser normalization', () => {
	for (const value of [
		null,
		42,
		'',
		'//evil.test',
		'javascript:alert(1)',
		'data:text/html,a',
		'https://user:pass@example.com',
		'https://@example.com',
		'https://example.com\\evil',
		'https://example.com/\n',
		'https://example.com/\u0000',
		'https:example.com',
		'https:///example.com',
		'https://example.com/' + 'a'.repeat(2048)
	]) {
		assert.equal(normalizeSafeUrl(value), null, String(value));
	}
	assert.equal(normalizeSafeUrl('/' + 'a'.repeat(2047))?.length, 2048);
});

test('domain values cannot contain URL syntax, wildcards, invalid labels or Unicode', () => {
	for (const value of [
		null,
		[],
		'',
		'*.example.com',
		'https://example.com',
		'example.com/a',
		'example.com?q=1',
		'example.com#x',
		'user@example.com',
		'example.com:443',
		'bad..example',
		'-bad.example',
		'bad-.example',
		'mañana.example',
		'a'.repeat(64) + '.test'
	]) {
		assert.equal(normalizeTrustedDomain(value), null, String(value));
	}
	assert.equal(getTrustedDomainFromUrl('/internal'), null);
});

test('sanitizes corrupted persisted lists and bounds both reading and returned data', () => {
	assert.deepEqual(
		sanitizeTrustedDomains(['EXAMPLE.COM', '*.bad.test', 12, 'example.com', 'a.test']),
		['example.com', 'a.test']
	);
	assert.deepEqual(sanitizeTrustedDomains({ domains: ['example.com'] }), []);
	assert.equal(
		sanitizeTrustedDomains(Array.from({ length: 150 }, (_, i) => `h${i}.test`)).length,
		100
	);
});

// Model only Mongo's atomic filter/update boundary; no live database is required.
type MutationFilter = {
	_id: ObjectId;
	$or?: ({ trustedDomains: string } | { 'trustedDomains.99': { $exists: boolean } })[];
};
type MutationUpdate = {
	$addToSet?: { trustedDomains: string };
	$pull?: { trustedDomains: string };
};
function usersFixture(initial: Record<string, string[] | undefined>) {
	const users = new Map(
		Object.entries(initial).map(([id, domains]) => [id, domains && [...domains]])
	);
	const calls: { filter: MutationFilter; update: MutationUpdate }[] = [];
	return {
		users,
		calls,
		async findOneAndUpdate(filter: MutationFilter, update: MutationUpdate) {
			calls.push({ filter, update });
			if (!users.has(filter._id.toHexString())) return null;
			const domains = users.get(filter._id.toHexString()) ?? [];
			if (
				filter.$or &&
				!filter.$or.some((condition) =>
					'trustedDomains' in condition
						? domains.includes(condition.trustedDomains)
						: condition['trustedDomains.99']?.$exists === false && domains.length < 100
				)
			)
				return null;
			if (update.$addToSet && !domains.includes(update.$addToSet.trustedDomains)) {
				domains.push(update.$addToSet.trustedDomains);
				users.set(filter._id.toHexString(), domains);
			}
			const removedDomain = update.$pull?.trustedDomains;
			if (removedDomain !== undefined && users.get(filter._id.toHexString()) !== undefined)
				users.set(
					filter._id.toHexString(),
					domains.filter((value) => value !== removedDomain)
				);
			const after = users.get(filter._id.toHexString());
			return after ? { trustedDomains: [...after] } : {};
		},
		async findOne(filter: { _id: ObjectId }) {
			const domains = users.get(filter._id.toHexString());
			return domains
				? { trustedDomains: [...domains] }
				: users.has(filter._id.toHexString())
					? {}
					: null;
		}
	};
}
const ownId = '507f1f77bcf86cd799439011';
const otherId = '507f1f77bcf86cd799439012';

test('legacy accounts without trustedDomains can remove idempotently and add their first host', async () => {
	const collection = usersFixture({ [ownId]: undefined, [otherId]: ['private.test'] });
	assert.deepEqual(
		await mutateTrustedDomainInCollection(collection, ownId, 'example.com', 'remove'),
		{
			status: 'ok',
			trustedDomains: []
		}
	);
	assert.equal(collection.users.get(ownId), undefined);
	assert.deepEqual(await mutateTrustedDomainInCollection(collection, ownId, 'example.com', 'add'), {
		status: 'ok',
		trustedDomains: ['example.com']
	});
	assert.deepEqual(collection.users.get(ownId), ['example.com']);
	assert.deepEqual(collection.users.get(otherId), ['private.test']);
});

test('atomic adds/removes are idempotent and isolated to the authenticated account', async () => {
	const collection = usersFixture({ [ownId]: [], [otherId]: ['private.test'] });
	assert.deepEqual(await mutateTrustedDomainInCollection(collection, ownId, 'example.com', 'add'), {
		status: 'ok',
		trustedDomains: ['example.com']
	});
	await mutateTrustedDomainInCollection(collection, ownId, 'example.com', 'add');
	assert.deepEqual(collection.users.get(ownId), ['example.com']);
	assert.deepEqual(collection.users.get(otherId), ['private.test']);
	assert.deepEqual(collection.calls[0].update, { $addToSet: { trustedDomains: 'example.com' } });
	assert.deepEqual(
		await mutateTrustedDomainInCollection(collection, ownId, 'example.com', 'remove'),
		{ status: 'ok', trustedDomains: [] }
	);
	assert.deepEqual(collection.calls.at(-1)?.update, { $pull: { trustedDomains: 'example.com' } });
	assert.deepEqual(
		await mutateTrustedDomainInCollection(collection, ownId, 'example.com', 'remove'),
		{ status: 'ok', trustedDomains: [] }
	);
});

test('concurrent capped adds never create the 101st host but duplicates still succeed', async () => {
	const collection = usersFixture({ [ownId]: Array.from({ length: 99 }, (_, i) => `h${i}.test`) });
	const results = await Promise.all(
		['a.test', 'b.test', 'c.test'].map((domain) =>
			mutateTrustedDomainInCollection(collection, ownId, domain, 'add')
		)
	);
	assert.equal(results.filter((result) => result.status === 'ok').length, 1);
	assert.equal(results.filter((result) => result.status === 'full').length, 2);
	assert.equal(collection.users.get(ownId)?.length, 100);
	assert.equal(
		(await mutateTrustedDomainInCollection(collection, ownId, 'h0.test', 'add')).status,
		'ok'
	);
	assert.equal(
		(await mutateTrustedDomainInCollection(collection, ownId, 'h0.test', 'remove')).status,
		'ok'
	);
	assert.equal(
		(await mutateTrustedDomainInCollection(collection, ownId, 'new.test', 'add')).status,
		'ok'
	);
});

test('missing accounts and invalid IDs cannot mutate another account', async () => {
	const collection = usersFixture({ [otherId]: ['private.test'] });
	assert.equal(
		(await mutateTrustedDomainInCollection(collection, ownId, 'example.com', 'add')).status,
		'not-found'
	);
	assert.equal(
		(await mutateTrustedDomainInCollection(collection, 'bad-id', 'example.com', 'remove')).status,
		'not-found'
	);
	assert.deepEqual(collection.users.get(otherId), ['private.test']);
	assert.equal(collection.calls.length, 1);
});

function request(body: string, contentType = 'application/json') {
	return new Request('https://school.test/api/profile/trusted-domains', {
		method: 'POST',
		headers: { 'content-type': contentType },
		body
	});
}
function requestDependencies() {
	const attempts: (CoreRateLimitOptions & { onError: 'closed' })[] = [];
	const mutations: { userId: string; domain: string; operation: 'add' | 'remove' }[] = [];
	return {
		attempts,
		mutations,
		async checkRateLimit(
			options: CoreRateLimitOptions & { onError: 'closed' }
		): Promise<RateLimitResult> {
			attempts.push(options);
			return { ok: true, remaining: 29, retryAfter: 0 };
		},
		async mutate(userId: string, domain: string, operation: 'add' | 'remove') {
			mutations.push({ userId, domain, operation });
			return { status: 'ok' as const, trustedDomains: operation === 'add' ? [domain] : [] };
		}
	};
}

test('mutation requests require a session before parsing, rate limiting or database access', async () => {
	const dependencies = requestDependencies();
	const response = await handleTrustedDomainMutation(request('{'), null, 'add', dependencies);
	assert.equal(response.status, 401);
	assert.equal(dependencies.attempts.length, 0);
	assert.equal(dependencies.mutations.length, 0);
});

test('rate limit is shared per user, 30 mutations/10min and fails closed before writes', async () => {
	const dependencies = requestDependencies();
	dependencies.checkRateLimit = async (options) => {
		dependencies.attempts.push(options);
		return { ok: false, remaining: 0, retryAfter: 600 };
	};
	const response = await handleTrustedDomainMutation(
		request('{"url":"https://example.com"}'),
		{ _id: ownId },
		'add',
		dependencies
	);
	assert.equal(response.status, 429);
	assert.equal(response.headers.get('retry-after'), '600');
	assert.deepEqual(dependencies.attempts, [
		{ key: `trusted-domains:${ownId}`, limit: 30, windowMs: 600000, onError: 'closed' }
	]);
	assert.equal(dependencies.mutations.length, 0);
});

test('mutation requests enforce bounded JSON, valid fields, and session ownership', async () => {
	for (const [body, contentType, expected] of [
		['{', 'application/json', 400],
		['{}', 'text/plain', 415],
		[JSON.stringify({ url: 'a'.repeat(5000) }), 'application/json', 413],
		['{}', 'application/json', 400],
		['[]', 'application/json', 400],
		['{"url":"javascript:alert(1)"}', 'application/json', 400],
		['{"url":"/internal"}', 'application/json', 400]
	] as const) {
		const dependencies = requestDependencies();
		assert.equal(
			(
				await handleTrustedDomainMutation(
					request(body, contentType),
					{ _id: ownId },
					'add',
					dependencies
				)
			).status,
			expected
		);
		assert.equal(dependencies.mutations.length, 0);
	}
	const dependencies = requestDependencies();
	assert.equal(
		(
			await handleTrustedDomainMutation(
				request(JSON.stringify({ url: 'https://EXAMPLE.com/path', userId: otherId })),
				{ _id: ownId },
				'add',
				dependencies
			)
		).status,
		200
	);
	assert.deepEqual(dependencies.mutations, [
		{ userId: ownId, domain: 'example.com', operation: 'add' }
	]);
	const removed = await handleTrustedDomainMutation(
		request('{"domain":"EXAMPLE.COM"}'),
		{ _id: ownId },
		'remove',
		dependencies
	);
	assert.deepEqual(await removed.json(), { ok: true, trustedDomains: [] });
});

test('mutation requests return missing-account and cap errors without claiming success', async () => {
	for (const [status, expected] of [
		['not-found', 404],
		['full', 409]
	] as const) {
		const dependencies = {
			...requestDependencies(),
			async mutate() {
				return { status };
			}
		};
		assert.equal(
			(
				await handleTrustedDomainMutation(
					request('{"url":"https://example.com"}'),
					{ _id: ownId },
					'add',
					dependencies
				)
			).status,
			expected
		);
	}
});
