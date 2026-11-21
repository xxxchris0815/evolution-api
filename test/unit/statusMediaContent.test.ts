import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeStatusMediaContent } from '../../src/utils/statusMediaContent';

test('normalizeStatusMediaContent strips data-URI prefix', () => {
  assert.equal(
    normalizeStatusMediaContent('data:image/jpeg;base64,abc123+/='),
    'abc123+/=',
  );
});

test('normalizeStatusMediaContent keeps plain base64 and urls', () => {
  assert.equal(normalizeStatusMediaContent('abc123+/='), 'abc123+/=');
  assert.equal(
    normalizeStatusMediaContent('https://cdn.example.com/story.jpg'),
    'https://cdn.example.com/story.jpg',
  );
});
