import { encode } from '@msgpack/msgpack';
import { decodeActionResponseData, decodeViewResponseData } from '../utils/bytes.js';

describe('public API contract snapshots', () => {
  it('snapshots SDK action response envelopes', () => {
    const envelope = [
      { value: 7 },
      [{ type: 'counter.incremented', payload: { amount: '2' } }],
      [],
      { participants: ['alice'], game_type: 'counter' },
      null,
    ];
    const resultHex = Buffer.from(encode(envelope)).toString('hex');

    expect(decodeActionResponseData({ resultHex })).toMatchInlineSnapshot(`
      {
        "envelope": {
          "error": null,
          "events": [
            {
              "payload": {
                "amount": "2",
              },
              "type": "counter.incremented",
            },
          ],
          "metadata": {
            "game_type": "counter",
            "participants": [
              "alice",
            ],
          },
          "state": {
            "value": 7,
          },
        },
        "error": undefined,
        "error_code": undefined,
        "error_data": undefined,
        "events": [
          {
            "payload": {
              "amount": "2",
            },
            "type": "counter.incremented",
          },
        ],
        "metadata": {
          "game_type": "counter",
          "participants": [
            "alice",
          ],
        },
        "new_state": {
          "value": 7,
        },
        "performance": undefined,
        "resultHex": "${resultHex}",
        "state": {
          "value": 7,
        },
      }
    `);
  });

  it('snapshots SDK view response envelopes', () => {
    const viewHex = Buffer.from(encode({ ownerId: 'alice', value: 7 })).toString('hex');

    expect(decodeViewResponseData({ resultHex: viewHex })).toMatchInlineSnapshot(`
      {
        "ownerId": "alice",
        "value": 7,
      }
    `);
  });

  it('snapshots SSE event payloads', () => {
    const event = {
      sequence: 42,
      scope_id: 'arcana-app:app',
      instance_id: 'counter-1',
      event_type: 'state_change',
      state_version: 9,
      client_mutation_id: 'mut-1',
      view_json: { value: 7 },
    };

    expect(event).toMatchInlineSnapshot(`
      {
        "client_mutation_id": "mut-1",
        "event_type": "state_change",
        "instance_id": "counter-1",
        "scope_id": "arcana-app:app",
        "sequence": 42,
        "state_version": 9,
        "view_json": {
          "value": 7,
        },
      }
    `);
  });

  it('snapshots effect JSON and history row surfaces', () => {
    const effect = {
      type: 'SCOPE_DATA_DEC',
      key: 'cage/alice/balance/usdc',
      amount: '100',
      fail_on_error: true,
    };
    const historyRow = {
      root_id: 'table-1',
      session_id: 'round-1',
      capsule_id: 'round-1-1700000000000',
      participant_id: 'alice',
      outcome: 1,
      timestamp_ms: 1700000000000,
    };

    expect({ effect, historyRow }).toMatchInlineSnapshot(`
      {
        "effect": {
          "amount": "100",
          "fail_on_error": true,
          "key": "cage/alice/balance/usdc",
          "type": "SCOPE_DATA_DEC",
        },
        "historyRow": {
          "capsule_id": "round-1-1700000000000",
          "outcome": 1,
          "participant_id": "alice",
          "root_id": "table-1",
          "session_id": "round-1",
          "timestamp_ms": 1700000000000,
        },
      }
    `);
  });

  it('snapshots manifest program declarations', () => {
    const program = {
      wasm: './programs/counter/build/counter.wasm',
      version: '0.1.0',
      singleton: true,
      privileges: {
        kv_read: ['config/'],
        kv_write: ['data/'],
        capabilities: [],
      },
    };

    expect(program).toMatchInlineSnapshot(`
      {
        "privileges": {
          "capabilities": [],
          "kv_read": [
            "config/",
          ],
          "kv_write": [
            "data/",
          ],
        },
        "singleton": true,
        "version": "0.1.0",
        "wasm": "./programs/counter/build/counter.wasm",
      }
    `);
  });
});
