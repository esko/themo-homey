'use strict';

const Homey = require('homey');
const { ThemoApi } = require('../../lib/themo-api');
const { mapState, MODE_TO_THEMO } = require('../../lib/themo-state');

class ThemoThermostatDevice extends Homey.Device {
  async onInit() {
    this.timer = null;
    this.api = new ThemoApi({
      username: this.getStoreValue('username'),
      password: this.getStoreValue('password')
    });
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
      if (!themoMode) throw new Error(`Unsupported thermostat mode: ${mode}`);
      await this.api.sendCommand(this.environmentId, this.apiDeviceId, { CMode: themoMode });
    });

    await this._schedule();
  }

  async _schedule() {
    if (this.timer) this.homey.clearInterval(this.timer);
    await this._poll().catch((error) => this._handleError(error));
    const seconds = Math.max(30, Number(this.getSetting('poll_interval')) || 120);
    this.timer = this.homey.setInterval(() => this._poll().catch((error) => this._handleError(error)), seconds * 1000);
  }

  async _poll() {
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
      .map(([capability, value]) => this.setCapabilityValue(capability, value)));
    await this.setAvailable();
  }

  async _handleError(error) {
    this.error(error);
    await this.setUnavailable(error.message).catch(this.error);
  }

  async onSettings({ changedKeys }) {
    if (changedKeys.includes('poll_interval')) await this._schedule();
  }

  async onDeleted() {
    if (this.timer) this.homey.clearInterval(this.timer);
  }
}

module.exports = ThemoThermostatDevice;

