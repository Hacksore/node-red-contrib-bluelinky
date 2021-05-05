# node-red-contrib-bluelinky
A node-red flow for controlling Hyundai BlueLink vehicles powered by [bluelinky](https://github.com/Hacksore/bluelinky)

[![npm](https://img.shields.io/npm/v/node-red-contrib-bluelinky.svg)](https://www.npmjs.com/package/bluelinky)
[![Discord](https://img.shields.io/discord/652755205041029120)](https://discord.gg/HwnG8sY)

![Sample](https://github.com/Nividica/node-red-contrib-bluelinky/blob/dev.nividica/docs/sample.jpg?raw=true)

## Supported Features
- Lock
- Unlock
- Start (with climate control)
- Stop
- Status

## Installation

### Install with command line
```sh
npm install node-red-contrib-bluelinky
```
### Install with Home Assistant OS
To use this with a Node-Red installation in Home Assistant:
1. Open the Home Assistant Supervisor Dashboard
1. Click on the Node-Red addon
1. Click on the Configuration tab
1. Add `node-red-contrib-bluelinky` to your npm_packages
   * You may also need to add `npm_packages:` if this is your first npm package
1. Save the configuration and restart the Node-Red addon

Example:
```yaml
npm_packages:
  - node-red-contrib-bluelinky
```
![Install via Node Red Config](https://github.com/Nividica/node-red-contrib-bluelinky/blob/dev.nividica/docs/install.hassos.jpg?raw=true)


## Documentation
*Jump down to the Quick Start section if you can't wait to play :)*

Checkout out the [bluelinky-docs](https://hacksore.github.io/bluelinky-docs/) for more info about how the bluelinky api works.

Once installed you should see the addition of bluelinky nodes in the node drawer:

![Bluelinky Nodes](https://github.com/Nividica/node-red-contrib-bluelinky/blob/dev.nividica/docs/new.nodes.jpg?raw=true)

Each of these nodes will perform their specified action when they receive any input message if they have a valid bluelinky configuration set.

Once you drag one out to a flow, they will have two outputs. The top output is the main output. The bottom output is exclusively used for error messages if the node is configured to use it. See Node Configuration below for additional details.

### Node Configuration
All node share the same base set of configuration options:

![Common Configuration Settings](https://github.com/Nividica/node-red-contrib-bluelinky/blob/dev.nividica/docs/common.config.jpg?raw=true)

* Send error message to separate output
  * Enabled: This will send any error messages to the bottom output, instead of the top output
  * Disabled: All messages will goto the top output.
* Ignore input while request is pending
  * Enabled: If an input message arrives while there is a request in progress, it will be ignored.
  * Disabled: If an input message arrives while there is a request in progress, it will join the existing request and be passed along with the results once the request finishes or errors. A new request will *not* be made.
* Timeout
  * If set to any positive value, will cause a timeout error to occur if a request does not finish in the specified time.
  * Note that most BlueLink service requests can take a few minutes, and timeouts less than 1 minute are not recommended for any node.
* Status
  * Controls the msg property which will be set once a request successfully finishes
* Error
  * Controls the msg property which will be set with an error if a request encounters an error
* Config
  * The Bluelinky configuration to use for this node

Additional options
* Refresh (Get Status, Get Full Status)
  * Enabled: Asks the BlueLink service to re-query the car for its status.
  * Disabled: Asks the BlueLink service to provide the most recent car status.
* Parsed (Get Status)
  * Parses the data into an easier to digest format
* Options (Start Car)
  * Controls the msg property which will be used for the [start options](https://hacksore.github.io/bluelinky-docs/docs/api-reference#start)

### Node Status Indicators
![Node Status](https://github.com/Nividica/node-red-contrib-bluelinky/blob/dev.nividica/docs/node.status.jpg?raw=true)
* `Awaiting Login...` The node wants to make a request, but is waiting for the shared configuration to complete it's login
* `Request sent...` The request has been handed off to Bluelinky
* `Request finished at` A request successfully completed at the specified time
* `Error at` A request errored out at the specified time

## Quickstart

* Start by dragging the `car - status` node into the flow, then double click the node to open the node editor.
* Next click the pencil icon to the right of `Config | Add new bluelinky...`
![Bluelinky Config Node](https://github.com/Nividica/node-red-contrib-bluelinky/blob/dev.nividica/docs/bluelinky.config.jpg?raw=true)
* Enter in all of the required information and click the `Add` button to return to the node editor.
  * Note that this is a shared configuration and can be used by other Bluelinky nodes.
* Leave all other fields in the node editor to their defaults, and click the `Done` button to return to the flow.
* Drag out an `Inject` and `Debug` node
* Wire the inject node to the input of the status node
* Wire the top output of the status node to the debug node
* Edit the debug node and change `Output` to `complete msg object`
* Deploy the flow
* Open the debug tab
* Click the inject button

If everything is setup correctly the status node should say `Request sent...` then a few moments later you should see the result in the debug tab, and the status node should report success or failure
![Quick Start Flow](https://github.com/Nividica/node-red-contrib-bluelinky/blob/dev.nividica/docs/quickstart.flow.jpg?raw=true)

## Troubleshooting
Important information for login problems:
- If you experience login problems, please logout from the app on your phone and login again. You might need to ' upgrade ' your account to a generic Kia/Hyundai account, or create a new password or PIN.
- After you migrated your Bluelink account to a generic Hyundai account, or your UVO account to a generic Kia account, make sure that both accounts have the same credentials (userid and password) to avoid confusion in logging in.

You can view the results of the last operation of any node by opening the context tab(right drawer), selecting the node in question, and clicking the small refresh icon to the right of `Node`

![Node Context](https://github.com/Nividica/node-red-contrib-bluelinky/blob/dev.nividica/docs/node.context.jpg?raw=true)
* lastOutput
  * An array showing what objects were appended to each output
  * [0] Is the main, top, output
  * [1] Is the error, bottom, output
* lastOutputTimestamp
  * Timestamp of when the `lastOutput` was set
  * If you need to see when this was, in your local time, I suggest copying the number, opening your browsers dev console, and passing the value to a new Date.
  For example, if your value was `1620209795310` you would enter the following:
  ```js
  > (new Date(1620209795310)).toLocaleString()
  < "5/5/2021, 6:16:35 AM"
  > |
  ```