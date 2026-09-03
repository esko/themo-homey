'use strict';

const BASE_URL = 'https://connect.themo.io';
const API_VERSION = 2;

class ThemoApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ThemoApiError';
    this.status = status;
  }
}

class ThemoApi {
  constructor({ username, password, fetchImpl = fetch }) {
    this.username = username;
    this.password = password;
    this.fetch = fetchImpl;
    this.token = null;
  }

  async authenticate() {
    const result = await this._request('api/auth/login', {
      method: 'POST',
      body: { Username: this.username, Password: this.password },
      authenticate: false
    });
    if (!result.Token) throw new ThemoApiError('Themo login did not return an access token');
    this.token = result.Token;
  }

  async _request(path, { method = 'GET', body, authenticate = true, retry = true } = {}) {
    if (authenticate && !this.token) await this.authenticate();
    const url = new URL(`${BASE_URL}/${path}`);
    url.searchParams.set('api-version', String(API_VERSION));
    const response = await this.fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(authenticate && this.token ? { Authorization: `Bearer ${this.token}` } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (response.status === 401 && authenticate && retry) {
      this.token = null;
      await this.authenticate();
      return this._request(path, { method, body, authenticate, retry: false });
    }
    if (!response.ok) {
      let detail = '';
      try { detail = await response.text(); } catch (_) { /* ignore */ }
      throw new ThemoApiError(`Themo API request failed (${response.status})${detail ? `: ${detail.slice(0, 160)}` : ''}`, response.status);
    }
    if (response.status === 204) return {};
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  async getAllDevices() {
    const environments = await this._request('api/environments');
    const devices = [];
    for (const environment of environments) {
      const rows = await this._request(`api/environments/${encodeURIComponent(environment.Id)}/devices?state=true`);
      for (const device of rows) devices.push({ ...device, environmentId: String(environment.Id) });
    }
    return devices;
  }

  getDevice(environmentId, deviceId) {
    return this._request(`api/environments/${encodeURIComponent(environmentId)}/devices/${encodeURIComponent(deviceId)}?state=true`);
  }

  getSchedules(environmentId, deviceId) {
    return this._request(`api/environments/${encodeURIComponent(environmentId)}/devices/${encodeURIComponent(deviceId)}/schedules`);
  }

  sendCommand(environmentId, deviceId, command) {
    return this._request(`api/environments/${encodeURIComponent(environmentId)}/devices/${encodeURIComponent(deviceId)}/commands/message`, {
      method: 'POST', body: command
    });
  }
}

module.exports = { ThemoApi, ThemoApiError };

