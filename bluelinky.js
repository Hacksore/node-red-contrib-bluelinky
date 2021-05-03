const BlueLinky = require('bluelinky');
const EventEmitter = require('events');

/**
 * @deprecated
 */
const State = new EventEmitter();

/**
 * Interacts with the BlueLink API
 *
 * @type {}
 * @deprecated Moving to config
 */
let client;

/**
 * 
 * @param {import('@node-red/registry').NodeAPI} RED 
 */
module.exports = function (RED) {
  /**
   * For consistency, these should mirror the defaults as defined in the HTML.
   * Needed for config migration across versions
   */
  const defaultConfigs = {
    GetVehicleStatus: {
      name: { value: 'Get full status' },
      dorefresh: { value: true },
      parsed: { value: false },
      bluelinky: { value: 'Bluelinky config', type: 'bluelinky' },
      timeoutamount: { value: 0 },
      timeoutunits: { value: 's' },
      msgproperty: { value: 'payload' },
      errorproperty: { value: 'payload' },
      senderrortoaltoutput: { value: false },
      ignoremessageifpending: { value: true },
    },
    GetFullVehicleStatus: {
      name: { value: 'Get full status' },
      dorefresh: { value: true },
      parsed: { value: false },
      bluelinky: { value: 'Bluelinky config', type: 'bluelinky' },
      timeoutamount: { value: 0 },
      timeoutunits: { value: 's' },
      msgproperty: { value: 'payload' },
      errorproperty: { value: 'payload' },
      senderrortoaltoutput: { value: false },
      ignoremessageifpending: { value: true },
    },
    Odometer: {
      name: { value: 'Get car odometer' },
      bluelinky: { value: 'Bluelinky config', type: 'bluelinky' },
      timeoutamount: { value: 0 },
      timeoutunits: { value: 's' },
      msgproperty: { value: 'payload' },
      errorproperty: { value: 'payload' },
      senderrortoaltoutput: { value: false },
      ignoremessageifpending: { value: true },
    }
  };

  /**
   * Sets any undefined/null value to the default value, excluding name and bluelinky
   */
  function applyDefaultConfig(config, defaultConfig) {
    Object.entries(defaultConfig).forEach(([key, { value }]) => {
      if (key === 'name' || key === 'bluelinky') {
        return;
      }
      if (config[key] == null) {
        config[key] = value;
      }
    });
  }

  /**
   * 
   * @param {BluelinkyNode} node
   * @param {CommonConfig} config
   * @param {(vehicle:Vehicle)=>Promise<any>} createVehicleRequest
   * @returns {DualOutputPromise}
   */
  const callAPI = async (node, config, createVehicleRequest) => {
    try {
      // Ensure bluelinky config
      if (node.bluelinkyConfig == null) {
        throw 'Bluelinky Config Is Not Set';
      }

      node.status({ fill: 'gray', shape: 'ring', text: 'Awaiting Login...' });
      // Wait until logged in
      await withTimeout(
        config.timeoutamount,
        config.timeoutunits,
        node.bluelinkyConfig.isLoggedIn
      );

      // Attempt to find the vehicle
      const vehicle = node.bluelinkyConfig.client.getVehicle(node.bluelinkyConfig.vin);

      // Start the request
      const vehicleRequest$ = createVehicleRequest(vehicle);

      // Request the status
      node.status({ fill: 'gray', shape: 'ring', text: 'Request sent...' });
      const requestResult = await withTimeout(
        config.timeoutamount,
        config.timeoutunits,
        vehicleRequest$
      );

      // Set the message and status
      node.status({ fill: 'green', shape: 'ring', text: `Request finished at ${(new Date()).toLocaleString()}` });
      const msgProperty = (config.msgproperty || '').trim() || 'payload';
      var msg = { [msgProperty]: requestResult };

      return [msg, undefined];

    } catch (error) {
      // Set the message and status
      node.status({ fill: 'red', shape: 'ring', text: `Error at ${(new Date()).toLocaleString()}` });
      const errorProperty = (config.errorproperty || '').trim() || 'payload';
      var msg = { [errorProperty]: error };

      if (config.senderrortoaltoutput) {
        // Send to alt output
        return [undefined, msg];
      } else {
        // Send to main output
        return [msg, undefined];
      }

    }
  };

  /**
   * 
   * @param {BluelinkyNode} node
   * @param {CommonConfig} config
   * @param {object} defaultConfig
   * @param {(vehicle:Vehicle)=>Promise<any>} createVehicleRequest
   */
  const createAPINode = (node, config, defaultConfig, createVehicleRequest) => {
    applyDefaultConfig(config, defaultConfig);

    // Create the node
    RED.nodes.createNode(node, config);

    /**
     * Get the config node
     */
    node.bluelinkyConfig = RED.nodes.getNode(config.bluelinky);

    /**
     * @type {DualOutputPromise | undefined}
     */
    let pendingRequest$ = undefined;

    // On input
    node.on('input', async (msg) => {
      if (pendingRequest$ === undefined) {
        // Set the pending request
        pendingRequest$ = callAPI(node, config, createVehicleRequest);

      } else if (config.ignoremessageifpending) {
        // Ignore
        return;
      }

      // Await the pending request
      const outputs = await pendingRequest$;

      // Clear the pending request
      pendingRequest$ = undefined;

      // Merge with the original message & send
      node.send(outputs.map(
        (output) => output ? Object.assign(msg, output) : undefined)
      );
    });
  };

  /**
   * @param {GetVehicleStatusConfig} config
   */
  function GetVehicleStatus(config) {
    createAPINode(
      this,
      config,
      defaultConfigs.GetVehicleStatus,
      (vehicle) => vehicle.status({
        refresh: !!config.dorefresh,
        parsed: !!config.parsed,
      })
    );
  }

  /**
   * 
   * @param {GetFullVehicleStatusConfig} config 
   */
  function GetFullVehicleStatus(config) {
    createAPINode(
      this,
      config,
      defaultConfigs.GetFullVehicleStatus,
      (vehicle) => vehicle.fullStatus({
        refresh: !!config.dorefresh
      })
    );
  }

  /**
   * 
   * @param {CommonConfig} config 
   */
  function Odometer(config) {
    createAPINode(
      this,
      config,
      defaultConfigs.Odometer,
      (vehicle) => vehicle.odometer()
    );
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

    /**
     * @type {BluelinkyConfigNode}
     */
    this.bluelinkyConfig = RED.nodes.getNode(config.bluelinky);
    this.status(this.bluelinkyConfig.status);
    this.bluelinkyConfig.statusEmitter.on('changed', (status) => this.status(status));

    this.on('input', async (msg) => {
      try {
        // Start the login process
        this.bluelinkyConfig.login();
        await this.bluelinkyConfig.isLoggedIn;
        msg.payload = `Logged in at ${(new Date()).toISOString()}`;

      } catch (error) {
        msg.payload = { error };

      } finally {
        this.send(msg);
      }
    });
  }


  /**
   * 
   * @param {BlueLinkyConfig} config 
   */
  function BluelinkyConfigNode(config) {
    // Create the node-red node
    RED.nodes.createNode(this, config);

    // Read in the config
    this.username = config.username;
    this.password = config.password;
    this.region = config.region;
    this.pin = config.pin;
    this.vin = config.vin;
    this.brand = config.brand;

    // Setup status emitter
    this.statusEmitter = new EventEmitter();
    this.statusEmitter.on('changed', (status) => this.status = status);

    /**
     * Controls the result of the login promise
     */
    const deferedLoginPromise = {
      /**
       * @type {(value:true)=>void}
       */
      resolve: undefined,
      /**
       * @type {(error:any)=>void}
       */
      reject: undefined,
      settled: true
    };

    /**
     * Promise
     * Starts out as unsettled
     * if client.ready => resolve(true)
     * if client.error => reject
     * if login => new promise
     *
     * Will never resolve to false.
     */
    const createLoginPromise = () => {
      // Reject old promise if unsettled
      if (!deferedLoginPromise.settled) {
        deferedLoginPromise.reject(new Error('Aborted'));
      }

      /**
       * Create the new promise
       */
      this.isLoggedIn = new Promise((resolve, reject) => {
        deferedLoginPromise.resolve = resolve;
        deferedLoginPromise.reject = reject;
        deferedLoginPromise.settled = false;
      });

      // Update the status when resolved/rejected
      this.isLoggedIn.then(
        () => this.statusEmitter.emit('changed', { fill: 'green', shape: 'ring', text: `Ready at ${(new Date()).toISOString()}` }),
        () => this.statusEmitter.emit('changed', { fill: 'red', shape: 'ring', text: `Error at ${(new Date()).toISOString()}` })
      );

      // Note when it is settled
      this.isLoggedIn.finally(() => deferedLoginPromise.settled = true);
    };
    /**
     * @type {Promise<true>}
     */
    this.isLoggedIn = undefined;
    createLoginPromise();

    /**
     * Create the client
     * @type {BlueLinky.default}
     */
    this.client = new BlueLinky({
      username: this.username,
      password: this.password,
      region: this.region,
      pin: this.pin,
      brand: this.brand,
    });


    const handleClientEvent = (event) => {
      // If already settled, this should goto a new promise
      if (deferedLoginPromise.settled) {
        createLoginPromise();
      }

      if (event === 'ready') {
        deferedLoginPromise.resolve(true);
      } else if (event === 'error') {
        deferedLoginPromise.reject(new Error('Unable to connect/login'));
      } else {
        deferedLoginPromise.reject(new Error('Unknown client status'));
      }
    };

    // Listen for client events
    this.client.on('ready', () => handleClientEvent('ready'));
    this.client.on('error', () => handleClientEvent('error'));

    // Define login
    this.login = () => {
      this.statusEmitter.emit('changed', { fill: 'grey', shape: 'ring', text: 'Logging in...' });
      createLoginPromise();
      this.client.login();
    };

    // TODO: When node is destroyed, reject login promise if pending
  }

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


  RED.nodes.registerType('bluelinky', BluelinkyConfigNode);
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
 * @typedef {import('bluelinky/dist/vehicles/vehicle').Vehicle} Vehicle
 */

/**
 * @typedef {import('@node-red/registry').Node} Node
 */

/**
 * @typedef {Object} BluelinkyConfigNode
 * @property {string} username
 * @property {string} password
 * @property {string} region
 * @property {string} pin
 * @property {string} vin
 * @property {string} brand
 * @property {EventEmitter} statusEmitter
 * @property {Promise<true>} isLoggedIn
 * @property {BlueLinky.default} client
 */

/**
 * @typedef {Node & {bluelinkyConfig:BluelinkyConfigNode}} BluelinkyNode
 */

/**
 * @typedef {Object} CommonConfig
 * @property {string} name
 * @property {any} bluelinky
 * @property {number} timeoutamount
 * @property {'s'|'m'|'h'} timeoutunits
 * @property {string} msgproperty,
 * @property {string} errorproperty,
 * @property {boolean} senderrortoaltoutput
 * @property {boolean} ignoremessageifpending
 */

/**
 * @typedef {CommonConfig & {dorefresh: boolean}} VehicleStatusConfig
 */

/**
 * @typedef {VehicleStatusConfig & {parsed: boolean}} GetVehicleStatusConfig
 */

/**
 * @typedef {VehicleStatusConfig} GetFullVehicleStatusConfig
 */

/**
 * @typedef {Object} BlueLinkyConfig
 * @property {string} username
 * @property {string} password
 * @property {string} region
 * @property {string} pin
 * @property {string} vin
 * @property {string} brand
 */

/**
 * @typedef {Promise<[object|undefined,object|undefined]>} DualOutputPromise
 * * [0]: Main output. Outputs success messages, and error messages if SendErrorToAltOutput is false
 * * [1]: Error output. Outputs error messages if SendErrorToAltOutput is true
 */
