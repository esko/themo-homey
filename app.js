'use strict';

const Homey = require('homey');

class ThemoApp extends Homey.App {
  async onInit() {
    this.log('Themo Thermostats has been initialized');
  }
}

module.exports = ThemoApp;

