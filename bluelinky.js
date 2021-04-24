const BlueLinky = require('bluelinky');
const EventEmitter = require('events');

const State = new EventEmitter();

/**
 * Interacts with the BlueLink API
 *
 * @type {BlueLinky.default}
 */
let client;

module.exports = function (RED) {

  /**
   * 
   * @param {number} timeoutAmount
   * @param {'s'|'m'|'h'} timeoutUnits
   * @returns {number}
   */
  function timeoutToMs(timeoutAmount, timeoutUnits) {
    return 1000 * timeoutAmount * (timeoutUnits === 'h' ? 3600 : timeoutUnits === 'm' ? 60 : 1);
  }

  /**
   * @template T
   * @param {Promise<T>} promise
   * @param {number} timeoutAmount
   * @param {'s'|'m'|'h'} timeoutUnits
   * @returns {Promise<T>}
   */
  function withTimeout(timeoutAmount, timeoutUnits, promise) {
    return timeoutAmount <= 0
      ? promise
      : Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject('Timed out'), timeoutToMs(timeoutAmount, timeoutUnits)))]);
  }

  /**
   * @param {GetVehicleStatusConfig} config
   */
  function GetVehicleStatus(config) {
    RED.nodes.createNode(this, config);
    this.bluelinkyConfig = RED.nodes.getNode(config.bluelinky);
    const node = this;

    const handleStatusUpdate = (statusObject) => {
      this.status(statusObject);
      if (statusObject.text === 'Ready') {
        this.connected = true;
      }
    };

    State.on('changed', handleStatusUpdate);
    // Update now
    handleStatusUpdate(this.bluelinkyConfig.status);

    node.on('input', async function (msg) {
      // Determine the property
      const msgProperty = config.msgproperty?.trim() || 'payload';

      try {
        // Ensure we are logged in
        if (!this.connected) {
          throw new Error('Not connected');
        }

        // Attempt to find the vehicle
        const car = client.getVehicle(this.bluelinkyConfig.vin);

        // Request the status
        const status = await withTimeout(
          config.timeoutamount,
          car.status({
            refresh: config.dorefresh,
            parsed: config.parsed,
          })
        );

        msg[msgProperty] = status;
      } catch (error) {
        msg[msgProperty] = { error };
      } finally {
        node.send(msg);
      }
    });
  }

  function GetFullVehicleStatus(config) {
    RED.nodes.createNode(this, config);
    this.bluelinkyConfig = RED.nodes.getNode(config.bluelinky);
    this.status(this.bluelinkyConfig.status);
    this.connected = false;
    const node = this;
    State.on('changed', (statusObject) => {
      this.status(statusObject);
      if (statusObject.text === 'Ready') {
        this.connected = true;
      }
    });
    node.on('input', async function (msg) {
      try {
        if (!this.connected) {
          return null;
        }
        const car = await client.getVehicle(this.bluelinkyConfig.vin);
        const status = await car.fullStatus({
          refresh: config.dorefresh,
        });
        node.send({
          payload: status,
        });
      } catch (err) {
        node.send({
          payload: err,
        });
      }
    });
  }

  function Unlock(config) {
    RED.nodes.createNode(this, config);
    this.bluelinkyConfig = RED.nodes.getNode(config.bluelinky);
    this.status(this.bluelinkyConfig.status);
    this.connected = false;
    const node = this;
    State.on('changed', (statusObject) => {
      this.status(statusObject);
      if (statusObject.text === 'Ready') {
        this.connected = true;
      }
    });
    node.on('input', async function (msg) {
      try {
        if (!this.connected) {
          return null;
        }
        await client.getVehicles();
        const car = await client.getVehicle(this.bluelinkyConfig.vin);
        this.status(this.bluelinkyConfig.status);
        const result = await car.unlock();
        node.send({
          payload: result,
        });
      } catch (err) {
        node.send({
          payload: err,
        });
      }
    });
  }

  function StartCharge(config) {
    RED.nodes.createNode(this, config);
    this.bluelinkyConfig = RED.nodes.getNode(config.bluelinky);
    this.status(this.bluelinkyConfig.status);
    this.connected = false;
    const node = this;
    State.on('changed', (statusObject) => {
      this.status(statusObject);
      if (statusObject.text === 'Ready') {
        this.connected = true;
      }
    });
    node.on('input', async function (msg) {
      try {
        if (!this.connected) {
          return null;
        }
        await client.getVehicles();
        const car = await client.getVehicle(this.bluelinkyConfig.vin);
        this.status(this.bluelinkyConfig.status);
        const result = await car.startCharge();
        node.send({
          payload: result,
        });
      } catch (err) {
        node.send({
          payload: err,
        });
      }
    });
  }

  function StopCharge(config) {
    RED.nodes.createNode(this, config);
    this.bluelinkyConfig = RED.nodes.getNode(config.bluelinky);
    this.status(this.bluelinkyConfig.status);
    this.connected = false;
    const node = this;
    State.on('changed', (statusObject) => {
      this.status(statusObject);
      if (statusObject.text === 'Ready') {
        this.connected = true;
      }
    });
    node.on('input', async function (msg) {
      try {
        if (!this.connected) {
          return null;
        }
        await client.getVehicles();
        const car = await client.getVehicle(this.bluelinkyConfig.vin);
        this.status(this.bluelinkyConfig.status);
        const result = await car.stopCharge();
        node.send({
          payload: result,
        });
      } catch (err) {
        node.send({
          payload: err,
        });
      }
    });
  }

  function Location(config) {
    RED.nodes.createNode(this, config);
    this.bluelinkyConfig = RED.nodes.getNode(config.bluelinky);
    this.status(this.bluelinkyConfig.status);
    this.connected = false;
    const node = this;
    State.on('changed', (statusObject) => {
      this.status(statusObject);
      if (statusObject.text === 'Ready') {
        this.connected = true;
      }
    });
    node.on('input', async function (msg) {
      try {
        if (!this.connected) {
          return null;
        }
        await client.getVehicles();
        const car = await client.getVehicle(this.bluelinkyConfig.vin);
        this.status(this.bluelinkyConfig.status);
        const result = await car.location();
        node.send({
          payload: result,
        });
      } catch (err) {
        node.send({
          payload: err,
        });
      }
    });
  }

  function Odometer(config) {
    RED.nodes.createNode(this, config);
    this.bluelinkyConfig = RED.nodes.getNode(config.bluelinky);
    this.status(this.bluelinkyConfig.status);
    this.connected = false;
    const node = this;

    State.on('changed', (statusObject) => {
      this.status(statusObject);
      if (statusObject.text === 'Ready') {
        this.connected = true;
      }
    });
    node.on('input', async function (msg) {
      try {
        if (!this.connected) {
          return null;
        }
        await client.getVehicles();
        const car = await client.getVehicle(this.bluelinkyConfig.vin);
        const result = await car.odometer();
        node.send({
          payload: result,
        });
      } catch (err) {
        node.send({
          payload: err,
        });
      }
    });
  }

  function Start(config) {
    RED.nodes.createNode(this, config);
    this.bluelinkyConfig = RED.nodes.getNode(config.bluelinky);
    this.status(this.bluelinkyConfig.status);
    this.connected = false;
    const node = this;
    State.on('changed', (statusObject) => {
      this.status(statusObject);
      if (statusObject.text === 'Ready') {
        this.connected = true;
      }
    });
    node.on('input', async function (msg) {
      try {
        if (!this.connected) {
          return null;
        }
        const car = await client.getVehicle(this.bluelinkyConfig.vin);
        const result = await car.start(msg.payload);
        node.send({
          payload: result,
        });
      } catch (err) {
        node.send({
          payload: err,
        });
      }
    });
  }

  function Stop(config) {
    RED.nodes.createNode(this, config);
    this.bluelinkyConfig = RED.nodes.getNode(config.bluelinky);
    this.status(this.bluelinkyConfig.status);
    this.connected = false;
    const node = this;
    State.on('changed', (statusObject) => {
      this.status(statusObject);
      if (statusObject.text === 'Ready') {
        this.connected = true;
      }
    });
    node.on('input', async function (msg) {
      try {
        if (!this.connected) {
          return null;
        }
        const car = await client.getVehicle(this.bluelinkyConfig.vin);
        const result = await car.stop(msg.payload);
        node.send({
          payload: result,
        });
      } catch (err) {
        node.send({
          payload: err,
        });
      }
    });
  }

  function Lock(config) {
    RED.nodes.createNode(this, config);
    this.bluelinkyConfig = RED.nodes.getNode(config.bluelinky);
    this.status(this.bluelinkyConfig.status);
    this.connected = false;
    const node = this;
    State.on('changed', (statusObject) => {
      this.status(statusObject);
      if (statusObject.text === 'Ready') {
        this.connected = true;
      }
    });
    node.on('input', async function (msg) {
      try {
        if (!this.connected) {
          return null;
        }
        let car = await client.getVehicle(this.bluelinkyConfig.vin);
        let result = await car.lock();
        node.send({
          payload: result,
        });
      } catch (err) {
        node.send({
          payload: err,
        });
      }
    });
  }

  function Login(config) {
    RED.nodes.createNode(this, config);
    this.bluelinkyConfig = RED.nodes.getNode(config.bluelinky);
    this.on('input', async function (msg) {
      State.emit('changed', { fill: 'grey', shape: 'ring', text: 'Logging in...' });
      client.login();
    });
  }

  function BluelinkyNode(config) {
    RED.nodes.createNode(this, config);
    this.username = config.username;
    this.password = config.password;
    this.region = config.region;
    this.pin = config.pin;
    this.vin = config.vin;
    this.brand = config.brand;
    this.status = { fill: 'grey', shape: 'ring', text: 'Logging in...' };
    State.emit('changed', this.status);

    client = new BlueLinky({
      username: this.username,
      password: this.password,
      region: this.region,
      pin: this.pin,
      brand: this.brand,
    });

    client.on('ready', () => {
      // we have logged in and have access to API now
      // how do we make sure nodes wait until the client is ready?
      this.status = { fill: 'green', shape: 'ring', text: 'Ready' };
      State.emit('changed', this.status);
    });

    client.on('error', () => {
      this.status = { fill: 'red', shape: 'ring', text: 'Error' };
      State.emit('changed', this.status);
    });
  }

  RED.nodes.registerType('bluelinky', BluelinkyNode);
  RED.nodes.registerType('login', Login);
  RED.nodes.registerType('car-status', GetVehicleStatus);
  RED.nodes.registerType('car-fullstatus', GetFullVehicleStatus);
  RED.nodes.registerType('unlock-car', Unlock);
  RED.nodes.registerType('lock-car', Lock);
  RED.nodes.registerType('car-odometer', Odometer);
  RED.nodes.registerType('car-location', Location);
  RED.nodes.registerType('start-car', Start);
  RED.nodes.registerType('stop-car', Stop);
  RED.nodes.registerType('start-charge', StartCharge);
  RED.nodes.registerType('stop-charge', StopCharge);
};

/**
 * @typedef {Object} GetVehicleStatusConfig
 * @property {string} name
 * @property {boolean} dorefresh
 * @property {boolean} parsed
 * @property {any} bluelinky
 * @property {number} timeoutamount
 * @property {'s'|'m'|'h'} timeoutunits
 * @property {string} msgproperty
 */
