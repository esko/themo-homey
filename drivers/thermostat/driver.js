'use strict';

const Homey = require('homey');
const { ThemoApi } = require('../../lib/themo-api');

class ThemoThermostatDriver extends Homey.Driver {
  async onPair(session) {
    let api;
    let credentials;
    let discovered = [];

    session.setHandler('login', async ({ username, password }) => {
      credentials = { username: String(username).trim(), password: String(password) };
      api = new ThemoApi(credentials);
      await api.authenticate();
      discovered = await api.getAllDevices();
      return true;
    });

    session.setHandler('list_devices', async () => discovered.map((device) => ({
      name: device.Name || `Themo ${device.DeviceId || device.Id}`,
      data: { id: String(device.DeviceId || device.Id) },
      store: {
        username: credentials.username,
        password: credentials.password,
        environmentId: String(device.environmentId),
        apiDeviceId: String(device.Id)
      },
      settings: { poll_interval: 120 }
    })));
  }
}

module.exports = ThemoThermostatDriver;

