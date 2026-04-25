import test from 'node:test';
import assert from 'node:assert/strict';

import { AuthServiceError } from './auth.js';
import { matchesPermissionPath, normalizePermissionPath } from './permission.js';

test('normalizePermissionPath normalizes root paths', () => {
	assert.equal(normalizePermissionPath('/'), '/');
});

test('normalizePermissionPath rejects non-absolute paths', () => {
	assert.throws(
		() => normalizePermissionPath('relative/path'),
		(error: unknown) => error instanceof AuthServiceError && error.statusCode === 400
	);
});

test('matchesPermissionPath matches exact and descendant paths', () => {
	assert.equal(matchesPermissionPath('/srv/data', '/srv/data'), true);
	assert.equal(matchesPermissionPath('/srv/data/project', '/srv/data'), true);
	assert.equal(matchesPermissionPath('/srv/dataset', '/srv/data'), false);
});

test('matchesPermissionPath treats root permission as global access', () => {
	assert.equal(matchesPermissionPath('/any/path', '/'), true);
});