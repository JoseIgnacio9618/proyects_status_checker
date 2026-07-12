import assert from 'node:assert/strict';
import test from 'node:test';
import { toStatusSocketUrl } from '../src/lib/service-url.ts';

test('converts HTTPS base URLs into secure status sockets', () => {
  assert.equal(
    toStatusSocketUrl('https://api.example.com/v1'),
    'wss://api.example.com/v1/status',
  );
});

test('preserves an explicit WebSocket protocol', () => {
  assert.equal(
    toStatusSocketUrl('ws://localhost:8080'),
    'ws://localhost:8080/status',
  );
});

test('rejects service URLs with embedded credentials', () => {
  assert.throws(
    () => toStatusSocketUrl('https://user:secret@example.com'),
    /must not include credentials/,
  );
});

test('rejects service URLs with fragments', () => {
  assert.throws(
    () => toStatusSocketUrl('https://api.example.com#private'),
    /must not include a fragment/,
  );
});
