import test from 'node:test';
import assert from 'node:assert/strict';

import { AuthServiceError, sanitizeUsername, validatePassword } from './auth.js';

test('sanitizeUsername trims and preserves valid usernames', () => {
	assert.equal(sanitizeUsername('  admin.user  '), 'admin.user');
});

test('sanitizeUsername rejects invalid usernames', () => {
	assert.throws(
		() => sanitizeUsername('no spaces allowed'),
		(error: unknown) => error instanceof AuthServiceError && error.statusCode === 400
	);
	assert.throws(
		() => sanitizeUsername('ab'),
		(error: unknown) => error instanceof AuthServiceError && error.statusCode === 400
	);
});

test('validatePassword accepts longer passwords', () => {
	assert.equal(validatePassword('secret123'), 'secret123');
});

test('validatePassword accepts short passwords', () => {
	assert.equal(validatePassword('short'), 'short');
});