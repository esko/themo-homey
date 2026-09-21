'use strict';

const Homey = require('homey');
const { ThemoApi } = require('../../lib/themo-api');

class ThemoThermostatDriver extends Homey.Driver {
  async onInit() {
    this.homey.flow.getConditionCard('floor_temperature_above').registerRunListener(async (args) => {
      const value = args.device.getCapabilityValue('measure_temperature.floor');
      return Number.isFinite(value) && value > args.temperature;
    });
    this.homey.flow.getConditionCard('is_heating').registerRunListener(async (args) => {
      return args.device.getCapabilityValue('themo_heating') === true;
    });
  }

  async onPair(session) {
    let api;
    let credentials;

    session.setHandler('login', async ({ username, password }) => {
      credentials = { username: String(username).trim(), password: String(password) };
      api = new ThemoApi(credentials);
      await this._authenticate(api);
      return true;
    });

    session.setHandler('list_devices', async () => {
      if (!api || !credentials) throw new Error('Sign in to Themo first');

      const discovered = await api.getAllDevices();
      this.log(`Pairing discovered ${discovered.length} Themo thermostat(s)`);
      if (discovered.length === 0) {
        throw new Error('Login succeeded, but the Themo account returned no thermostats');
      }

      return discovered.map((device) => ({
        name: device.Name || `Themo ${device.DeviceId || device.Id}`,
        data: { id: String(device.DeviceId || device.Id) },
        store: {
          username: credentials.username,
          password: credentials.password,
          environmentId: String(device.environmentId),
          apiDeviceId: String(device.Id)
        },
        settings: { poll_interval: 120 }
      }));
    });
  }

  async onRepair(session, device) {
    session.setHandler('login', async ({ username, password }) => {
      const credentials = { username: String(username).trim(), password: String(password) };
      await this._authenticate(new ThemoApi(credentials));

      const previousUsername = device.getStoreValue('username');
      const devices = this.getDevices().filter((item) => item.getStoreValue('username') === previousUsername);
      await Promise.all(devices.map((item) => item.applyCredentials(credentials)));
      return true;
    });
  }

  async _authenticate(api) {
    try {
      await api.authenticate();
    } catch (error) {
      if (error.status === 401) throw new Error('Incorrect e-mail address or password');
      throw error;
    }
  }
}

module.exports = ThemoThermostatDriver;
