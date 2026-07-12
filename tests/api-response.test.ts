import assert from 'node:assert/strict';
import test from 'node:test';
import { ValidationError, readServiceInput } from '../src/lib/api-response.ts';

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('normalizes a valid service payload', async () => {
  const input = await readServiceInput(jsonRequest({
    name: 'Billing API',
    url: 'billing.example.com',
    enabled: false,
  }));

  assert.deepEqual(input, {
    name: 'Billing API',
    url: 'https://billing.example.com/',
    enabled: false,
  });
});

test('requires a boolean enabled value', async () => {
  await assert.rejects(
    readServiceInput(jsonRequest({ name: 'Billing API', url: 'https://billing.example.com', enabled: 'false' })),
    ValidationError,
  );
});
