'use strict';

const MODE_FROM_THEMO = { SLS: 'auto', Manual: 'heat', Off: 'off' };
const MODE_TO_THEMO = { auto: 'SLS', heat: 'Manual', off: 'Off' };

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapState(device, schedules = []) {
  const state = device.State || {};
  const load = finite(state.LS);
  const maxPowerKw = finite(state.MP);
  return {
    roomTemperature: finite(state.Info ?? state.RT),
    floorTemperature: finite(state.FloorT),
    targetTemperature: finite(state.MT),
    mode: MODE_FROM_THEMO[state.Mode] || 'off',
    heating: load !== null ? load > 0 : false,
    powerWatts: load !== null && maxPowerKw !== null ? Math.round(load * maxPowerKw * 1000) : null,
    activeSchedule: schedules.find((schedule) => schedule.Active)?.Name || ''
  };
}

module.exports = { mapState, MODE_TO_THEMO };

