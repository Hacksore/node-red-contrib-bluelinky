const BlueLinky = require('bluelinky');

/**
 * 
 * @param {import('@node-red/registry').NodeAPI} RED 
 */
module.exports = function (RED) {
  /**
   * For consistency, these should mirror the defaults as defined in the HTML.
   * Needed for config migration across versions
   */
  const commonDefaults = {
    bluelinky: { value: 'Bluelinky config', type: 'bluelinky' },
    timeoutamount: { value: 0 },
    timeoutunits: { value: 's' },
    msgproperty: { value: 'payload' },
    errorproperty: { value: 'payload' },
    senderrortoaltoutput: { value: false },
    ignoremessageifpending: { value: true },
  };
  const defaultConfigs = {
    GetVehicleStatus: {
      ...commonDefaults,
      name: { value: 'Get full status' },
      dorefresh: { value: true },
      parsed: { value: false },
    },
    GetFullVehicleStatus: {
      ...commonDefaults,
      name: { value: 'Get full status' },
      dorefresh: { value: true },
    },
    Odometer: {
      ...commonDefaults,
      name: { value: 'Get car odometer' },
    },
    Location: {
      ...commonDefaults,
      name: { value: 'Get car location' },
    },
    Unlock: {
      ...commonDefaults,
      name: { value: 'Unlock car' },
    },
    Lock: {
      ...commonDefaults,
      name: { value: 'Lock car' },
    },
    StartCar: {
      ...commonDefaults,
      name: { value: 'Start car' }
    },
    StopCar: {
      ...commonDefaults,
      name: { value: 'Stop car' }
    },
    StartCharge: {
      ...commonDefaults,
      name: { value: 'Start Charging' }
    },
    StopCharge: {
      ...commonDefaults,
      name: { value: 'Stop Charging' }
    },
    Login: {
      ...commonDefaults,
      name: { value: 'Login' }
    },
  };

  // #region Helper functions

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
   * @template T
   * @param {Promise<T>} promise
   * @param {number} timeoutAmount
   * @param {'s'|'m'|'h'} timeoutUnits
   * @returns {Promise<T>}
   */
  function withTimeout(timeoutAmount, timeoutUnits, promise) {
    // Calculate how many ms to wait
    const waitMs = 1000 * timeoutAmount * (timeoutUnits === 'h' ? 3600 : timeoutUnits === 'm' ? 60 : 1);

    return timeoutAmount <= 0
      ? promise
      : Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject('Timed out'), waitMs))]);
  }

  /**
   * Wraps an async request (presumably one to the BlueLinky API) and maps the result/error to the configured output.
   *
   * Ensures the bluelinky config has been set, and that we are logged in.
   * 
   * The nods status is set while awaiting login, when the request is made, and once the
   * request finishes or errors. If you want to set a custom status while the request is
   * pending, you should do so when `makeRequest()` is called.
   * @param {BluelinkyNode} node
   * @param {CommonConfig} config
   * @param {()=>Promise<any>} makeRequest Called once the logged in and the BlueLinky API is ready
   * @param {((inputMsg:any)=>Promise<void>)?} init Called before anything else
   * @returns {DualOutputPromise}
   */
  const wrapAPIRequest = async (node, config, makeRequest, init) => {
    try {
      if (init) {
        await init();
      }

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

      // Make the request
      node.status({ fill: 'gray', shape: 'ring', text: 'Request sent...' });
      const requestResult = await withTimeout(
        config.timeoutamount,
        config.timeoutunits,
        makeRequest()
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
   * @param {(inputMsg:any)=>DualOutputPromise} makeRequest  Called once the logged in and the BlueLinky API is ready
   * @param {((inputMsg:any)=>Promise<void>)?} init  Called when an input message arrives, and before makeRequest is wrapped
   */
  const createAPIFlowNode = (node, config, defaultConfig, makeRequest, init) => {
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
        pendingRequest$ = wrapAPIRequest(
          node,
          config,
          async () => makeRequest(msg),
          init ? (async () => init(msg)) : undefined
        );

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
   * 
   * @param {BluelinkyNode} node
   * @param {CommonConfig} config
   * @param {object} defaultConfig
   * @param {(vehicle:Vehicle, inputMsg:any)=>Promise<any>} makeVehicleRequest
   */
  const createVehicleAPIFlowNode = (node, config, defaultConfig, makeVehicleRequest) => {
    createAPIFlowNode(
      node,
      config,
      defaultConfig,
      async (msg) => {
        // Attempt to find the vehicle
        const vehicle = node.bluelinkyConfig.client.getVehicle(node.bluelinkyConfig.vin);

        // Make the request
        return makeVehicleRequest(vehicle, msg);
      }
    );
  };

  // #endregion

  /**
   * @param {GetVehicleStatusConfig} config
   */
  function GetVehicleStatus(config) {
    createVehicleAPIFlowNode(
      this,
      config,
      defaultConfigs.GetVehicleStatus,
      async (vehicle) => vehicle.status({
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
    createVehicleAPIFlowNode(
      this,
      config,
      defaultConfigs.GetFullVehicleStatus,
      async (vehicle) => vehicle.fullStatus({
        refresh: !!config.dorefresh
      })
    );
  }

  /**
   * 
   * @param {CommonConfig} config 
   */
  function Odometer(config) {
    createVehicleAPIFlowNode(
      this,
      config,
      defaultConfigs.Odometer,
      async (vehicle) => vehicle.odometer()
    );
  }

  /**
   * 
   * @param {CommonConfig} config 
   */
  function Location(config) {
    createVehicleAPIFlowNode(
      this,
      config,
      defaultConfigs.Location,
      async (vehicle) => vehicle.location()
    );
  }

  /**
   * 
   * @param {CommonConfig} config 
   */
  function Unlock(config) {
    createVehicleAPIFlowNode(
      this,
      config,
      defaultConfigs.Unlock,
      async (vehicle) => vehicle.unlock()
    );
  }

  /**
   * 
   * @param {CommonConfig} config 
   */
  function Lock(config) {
    createVehicleAPIFlowNode(
      this,
      config,
      defaultConfigs.Lock,
      async (vehicle) => vehicle.lock()
    );
  }

  /**
   * 
   * @param {CommonConfig} config 
   */
  function Start(config) {
    createVehicleAPIFlowNode(
      this,
      config,
      defaultConfigs.StartCar,
      async (vehicle, msg) => vehicle.start(msg.payload)
    );
  }

  /**
   * 
   * @param {CommonConfig} config 
   */
  function Stop(config) {
    createVehicleAPIFlowNode(
      this,
      config,
      defaultConfigs.StopCar,
      async (vehicle) => vehicle.stop()
    );
  }

  /**
   * 
   * @param {CommonConfig} config 
   */
  function StartCharge(config) {
    createVehicleAPIFlowNode(
      this,
      config,
      defaultConfigs.StartCharge,
      async (vehicle) => vehicle.startCharge()
    );
  }

  /**
   * 
   * @param {CommonConfig} config 
   */
  function StopCharge(config) {
    createVehicleAPIFlowNode(
      this,
      config,
      defaultConfigs.StopCharge,
      async (vehicle) => vehicle.stopCharge()
    );
  }

  /**
   * 
   * @param {CommonConfig} config 
   */
  function Login(config) {
    createAPIFlowNode(
      this,
      config,
      defaultConfigs.Login,
      // `wrapAPIRequest` already awaits login, so we don't need to here
      async () => `Logged in at ${(new Date()).toISOString()}`,

      // Start the login process
      async () => this.bluelinkyConfig.login(),
    );
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
        () => this.status = { fill: 'green', shape: 'ring', text: `Ready at ${(new Date()).toISOString()}` },
        () => this.status = { fill: 'red', shape: 'ring', text: `Error at ${(new Date()).toISOString()}` }
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
      this.status = { fill: 'grey', shape: 'ring', text: 'Logging in...' };
      createLoginPromise();
      this.client.login();
    };

    // TODO: When node is destroyed, reject login promise if pending
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

// #region Typedefs
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

// #endregion
