'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mapState, MODE_TO_THEMO } = require('../lib/themo-state');

test('maps Themo state to Homey capabilities', () => {
  const state = mapState({ State: { Info: 21.4, FloorT: 24.8, MT: 22, Mode: 'Manual', LS: 1, MP: 1.5 } }, [
    { Name: 'Weekday', Active: true }
  ]);
  assert.deepEqual(state, {
    roomTemperature: 21.4,
    floorTemperature: 24.8,
    targetTemperature: 22,
    mode: 'heat',
    heating: true,
    powerWatts: 1500,
    activeSchedule: 'Weekday'
  });
});

test('maps Homey modes to Themo commands', () => {
  assert.deepEqual(MODE_TO_THEMO, { auto: 'SLS', heat: 'Manual', off: 'Off' });
});

test('maps Themo Off to Homey off', () => {
  const state = mapState({ State: { Mode: 'Off', LS: 0, MP: 1 } });
  assert.equal(state.mode, 'off');
  assert.equal(state.heating, false);
  assert.equal(state.powerWatts, 0);
});

test('leaves unknown Themo modes unset', () => {
  const state = mapState({ State: { Mode: 'Holiday' } });
  assert.equal(state.mode, null);
  assert.equal(state.activeSchedule, '');
});

