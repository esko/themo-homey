'use strict';

const Homey = require('homey');
const { ThemoApi } = require('../../lib/themo-api');

class ThemoThermostatDriver extends Homey.Driver {
  async onPair(session) {
    let api;
    let credentials;

    session.setHandler('login', async ({ username, password }) => {
      credentials = { username: String(username).trim(), password: String(password) };
      api = new ThemoApi(credentials);
      await api.authenticate();
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
}

module.exports = ThemoThermostatDriver;
