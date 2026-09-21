'use strict';

const Homey = require('homey');
const { ThemoApi } = require('../../lib/themo-api');
const { mapState, MODE_TO_THEMO } = require('../../lib/themo-state');

class ThemoThermostatDevice extends Homey.Device {
  async onInit() {
    this.timer = null;
    this._hasPolled = false;
    this._floorTrigger = this.homey.flow.getDeviceTriggerCard('floor_temperature_changed');
    this._heatingStarted = this.homey.flow.getDeviceTriggerCard('heating_started');
    this._heatingStopped = this.homey.flow.getDeviceTriggerCard('heating_stopped');
    this._scheduleTrigger = this.homey.flow.getDeviceTriggerCard('schedule_changed');
    this._bindApi();

    this.environmentId = this.getStoreValue('environmentId');
    this.apiDeviceId = this.getStoreValue('apiDeviceId');

    this.registerCapabilityListener('target_temperature', async (temperature) => {
      const mode = this.getCapabilityValue('thermostat_mode');
      if (mode !== 'heat') await this.api.sendCommand(this.environmentId, this.apiDeviceId, { CMode: 'Manual' });
      await this.api.sendCommand(this.environmentId, this.apiDeviceId, { CMT: temperature });
      await this.setCapabilityValue('thermostat_mode', 'heat');
    });
    this.registerCapabilityListener('thermostat_mode', async (mode) => {
      const themoMode = MODE_TO_THEMO[mode];
      if (!themoMode) throw new Error('This thermostat does not support that mode');
      await this.api.sendCommand(this.environmentId, this.apiDeviceId, { CMode: themoMode });
    });

    await this._schedule();
  }

  _bindApi() {
    this.api = new ThemoApi({
      username: this.getStoreValue('username'),
      password: this.getStoreValue('password')
    });
  }

  async applyCredentials({ username, password }) {
    await this.setStoreValue('username', username);
    await this.setStoreValue('password', password);
    this._bindApi();
    await this._schedule();
  }

  async _schedule() {
    this._stopPolling();
    await this._poll().catch((error) => this._handleError(error));
    const seconds = Math.max(30, Number(this.getSetting('poll_interval')) || 120);
    this.timer = this.homey.setInterval(() => this._poll().catch((error) => this._handleError(error)), seconds * 1000);
  }

  _stopPolling() {
    if (this.timer) {
      this.homey.clearInterval(this.timer);
      this.timer = null;
    }
  }

  async _poll() {
    const previous = {
      floor: this.getCapabilityValue('measure_temperature.floor'),
      heating: this.getCapabilityValue('themo_heating'),
      schedule: this.getCapabilityValue('themo_schedule')
    };
    const [device, schedules] = await Promise.all([
      this.api.getDevice(this.environmentId, this.apiDeviceId),
      this.api.getSchedules(this.environmentId, this.apiDeviceId)
    ]);
    const state = mapState(device, schedules);
    const updates = {
      measure_temperature: state.roomTemperature,
      'measure_temperature.floor': state.floorTemperature,
      target_temperature: state.targetTemperature,
      thermostat_mode: state.mode,
      measure_power: state.powerWatts,
      themo_heating: state.heating,
      themo_schedule: state.activeSchedule
    };
    await Promise.all(Object.entries(updates)
      .filter(([, value]) => value !== null)
      .map(([capability, value]) => this.setCapabilityValue(capability, value).catch((error) => this.error(error))));
    if (this._hasPolled) {
      if (Number.isFinite(state.floorTemperature) && state.floorTemperature !== previous.floor) {
        await this._floorTrigger.trigger(this, { temperature: state.floorTemperature }).catch((error) => this.error(error));
      }
      if (state.heating !== previous.heating) {
        const card = state.heating ? this._heatingStarted : this._heatingStopped;
        await card.trigger(this).catch((error) => this.error(error));
      }
      if (state.activeSchedule !== previous.schedule) {
        await this._scheduleTrigger.trigger(this, { schedule: state.activeSchedule }).catch((error) => this.error(error));
      }
    }
    this._hasPolled = true;
    await this.setAvailable();
  }

  async _handleError(error) {
    this.error(error);
    await this.setUnavailable(error.message).catch((error) => this.error(error));
  }

  async onSettings({ changedKeys }) {
    if (changedKeys.includes('poll_interval')) await this._schedule();
  }

  async onUninit() {
    this._stopPolling();
  }

  async onDeleted() {
    this._stopPolling();
  }
}

module.exports = ThemoThermostatDevice;
