const HUMIDITY_THRESHOLD = 10; // Humidity increase threshold
const SWITCH_ID = 0; // ID of the switch to control
const BLU_MAC = "38:39:8f:70:b2:4e".toLowerCase(); // Ensure the MAC address is lowercase
const HUMIDITY_TIMEOUT = 25;
const BUTTON_TIMEOUT = 5;

let previousHumidity = null;
let switchState = false;
let buttonTimer = null;
let humidityTimer = null;
let tempHumidity = null;
  
// Function to check if humidity is high
function isHumidityHigh(humidity) {
  tempHumidity = previousHumidity;
  previousHumidity = humidity;
//  console.log("High - Previous humidity: ", tempHumidity, " humidity: ", humidity);
  return humidity > tempHumidity + HUMIDITY_THRESHOLD;
  
}

// Function to check if humidity is back to normal
function isHumidityLow(humidity) {
//  console.log("Low - Previous humidity: ", previousHumidity, " humidity: ", humidity);
  return humidity <= previousHumidity + HUMIDITY_THRESHOLD; // +1?
}
function startTimer(timer, timeout) {
  console.log('startTimer');
  Timer.clear(timer);
  timer = Timer.set(timeout * 60 * 1000,
    false,
    function () 
    {
      Shelly.call("Switch.Set", { id: SWITCH_ID, on: false }); // Turn the switch off
      console.log('Switch turned OFF (timer): ',timer);
    },
    null);
  switchState = false;
  };
function stopTimer(timer) {
  console.log('stopTimer');
  Timer.clear(timer);
  };
      
function handleHighHumidity(data) {
  Shelly.call("Switch.GetStatus", { id: SWITCH_ID },
    function(result, error_code, error_message, ud) {
      if (error_code === 0) { // Check if the call was successful
        switchState = result.output;
        console.log("Humidity switch state:", switchState);
        // You can now use `switchState` here or trigger other functions
        if (!switchState) {
          // Switch is off, turn it on
          console.log('Switch turned ON');
          Shelly.call("Switch.Set", { id: SWITCH_ID, on: true }); // Turn the switch on
          switchState = true;
          // Set a timeout to turn the switch off after 25 minutes
          startTimer(humidityTimer, HUMIDITY_TIMEOUT);       
      } else {
          // Do something else if the switch is off
        }
      } else {
        console.log("Error getting switch status:", error_message);
      }
    }, 
    null
  );
  //  switchState = Shelly.getComponentStatus("switch:0").output;
//  console.log('Handle switch state: ', JSON.stringify(switchState));
}
function handleLowHumidity(data) {
  Shelly.call("Switch.GetStatus", { id: SWITCH_ID },
    function(result, error_code, error_message, ud) {
      if (error_code === 0) { // Check if the call was successful
        switchState = result.output;
        console.log("Humidity switch state:", switchState);

        // You can now use `switchState` here or trigger other functions
        if (switchState) {
          // Switch is n, turn it off
          console.log('Switch turned OFF');
          Shelly.call("Switch.Set", { id: SWITCH_ID, on: false }); // Turn the switch off
          switchState = false;
          // Set a timeout to turn the switch off after 25 minutes
          stopTimer(humidityTimer);
      } else {
          // Do something else if the switch is off
        }
      } else {
        console.log("Error getting switch status:", error_message);
      }
    }, 
    null
  );
}
let CONFIG = {
  debug: false,
  scenes: [
    /** SCENE START 0 **/
    {
      conditions: {
        event: "shelly-blu",
        address: BLU_MAC,
        button: {
          compare: ">",
          value: 0,
        },
      },
      action: function (data) {
        console.log("The button was pressed");
        Shelly.call("Switch.Toggle", { id: SWITCH_ID });
        Shelly.call("Switch.GetStatus", { id: SWITCH_ID },
          function(result, error_code, error_message, ud) {
            if (error_code === 0) { // Check if the call was successful
              switchState = result.output;
              console.log("Button switch state:", switchState);
      
              // You can now use `switchState` here or trigger other functions
              if (switchState) {
                startTimer(buttonTimer, BUTTON_TIMEOUT);
              } else {
                stopTimer(buttonTimer);
              }
    
            } else {
              console.log("Error getting switch status:", error_message);
            }
          }, 
          null
        );
//        console.log("CONFIG switchState: ", JSON.stringify(switchState));
    // Set a timeout to turn the switch off after 5 minutes
      },
    },
    /** SCENE END 0 **/

    /** SCENE START 1 - Shelly BLU High Humidity example **/
    {
      conditions: {
        event: "shelly-blu",
        address: BLU_MAC,
        humidity: function (humidity) {
          return isHumidityHigh(humidity);
        },
      },
      action: function (data, info) {
        console.log("Humidity is high.");
        handleHighHumidity(data);
//        infStruct = Shelly.getDeviceInfo();
//        MQTT.publish(
//        "mymqttbroker/shelly/humidity",
//          "Humidity at " + data.address + " / " + infStruct.name + " is high."
//        );
      },
    },
    /** SCENE END 1 **/

    /** SCENE START 2 - Shelly BLU Low Humidity example **/
    {
      conditions: {
        event: "shelly-blu",
        address: BLU_MAC,
        humidity: function (humidity) {
          return !isHumidityHigh(humidity) && isHumidityLow(humidity);
        },
      },
      action: function (data, info) {
        console.log("Humidity is low.");
        handleLowHumidity(data);
//        info = Shelly.getDeviceInfo();
//        MQTT.publish(
//          "mymqttbroker/shelly/humidity",
//          "Humidity at " + data.address + " / " + info.name + " is low."
//        );
      },
    },
    /** SCENE END 2 **/

    /** SCENE START 3 - Shelly BLU Scanner example **/
    {
      conditions: {
        event: "shelly-blu",
      },
      action: function (data) {
        console.log("Shelly BLU device found", JSON.stringify(data));
      },
    },
    /** SCENE END 3 **/
  ],
  //When set to true, debug messages will be logged to the console
  debug: false,
};

// Logs the provided message with an optional prefix to the console
function logger(message, prefix) {
  if (!CONFIG.debug) {
    return;
  }

  let finalText = "";

  if (Array.isArray(message)) {
    for (let i = 0; i < message.length; i++) {
      finalText += " " + JSON.stringify(message[i]);
    }
  } else {
    finalText = JSON.stringify(message);
  }

  if (typeof prefix !== "string") {
    prefix = "";
  } else {
    prefix += ":";
  }

  console.log(prefix, finalText);
}
// Scene Manager object
let SceneManager = {
  scenes: [],

  setScenes: function (scenes) {
    this.scenes = scenes;
  },
  
  onNewData: function (data) {
    try {
        logger(["New data received", JSON.stringify(data)], "Info");

        for (let sceneIndex = 0; sceneIndex < this.scenes.length; sceneIndex++) {
            logger(["Validating conditions for scene with index=", sceneIndex], "Info");

            if (this.validateConditionsForScene(sceneIndex, data)) {
                logger(["Conditions are valid for scene with index=", sceneIndex], "Info");
                this.executeScene(sceneIndex, data);
            } else {
                logger(["Conditions are invalid for scene with index=", sceneIndex], "Info");
            }
        }
    } catch (error) {
        console.log("Error in onNewData:", error.message);
        logger(["Error processing new data. Error:", error.message], "Error");
    }
  },

  eventHandler: function (eventData, sceneEventObject) {
    let info = eventData.info;
    if (typeof info !== "object") {
      console.log("ERROR: ");
      logger("Can't find the info object", "Error");

      return;
    }

    if (typeof info.data === "object") {
      for (let key in info.data) {
        info[key] = info.data[key];
      }

      info.data = undefined;
    }

    sceneEventObject.onNewData(info);
  },

  checkCondition: function (compFunc, currValue, compValue) {
    if (
      typeof currValue === "undefined" ||
      typeof compValue === "undefined" ||
      typeof compFunc === "undefined"
    ) {
      return false;
    }

    if (typeof compFunc === "string") {
      if(compFunc in this.compFuncList) {
        compFunc = this.compFuncList[compFunc];
      }
      else {
        logger(["Unknown compare function", compFunc], "Error");
      }
    }

    if (typeof compFunc === "function") {
      return compFunc(currValue, compValue);
    }

    return false;
  },

  validateConditionsForScene: function (sceneIndex, receivedData) {
    if (
      typeof sceneIndex !== "number" ||
      sceneIndex < 0 ||
      sceneIndex >= this.scenes.length
    ) {
      return false;
    }

    let conditions = this.scenes[sceneIndex].conditions;
    if (typeof conditions === "undefined") {
      return false;
    }

    for (let condKey in conditions) {
      let condData = conditions[condKey];
      let currValue = receivedData[condKey];
      let compValue = condData;
      let compFunc = condData;

      if (typeof condData === "object") {
        compValue = condData.value;
        compFunc = condData.compare;
      } else if (typeof condData !== "function") {
        compFunc = "==";
      }

      if (!this.checkCondition(compFunc, currValue, compValue)) {
        logger(
          ["Checking failed for", condKey, "in scene with index=", sceneIndex],
          "Info"
        );
        return false;
      }
    }

    return true;
  },

executeScene: function (sceneIndex, data) {
    try {
        if (
            typeof sceneIndex !== "number" ||
            sceneIndex < 0 ||
            sceneIndex >= this.scenes.length
        ) {
            throw new Error("Invalid scene index: " + sceneIndex);
        }

        let func = this.scenes[sceneIndex].action;
        if (typeof func !== "function") {
            throw new Error("Action for scene at index " + sceneIndex + " is not a function");
        }

        logger(["Executing action for scene with index=", sceneIndex], "Info");
        func(data);

    } catch (error) {
        console.log("Error in executeScene:", error.message);
        logger(["Error executing scene with index=", sceneIndex, "Error:", error.message], "Error");
    }
},

  compFuncList: {
    "==": function (currValue, compValue) {
      if (typeof currValue !== typeof compValue) {
        return false;
      }
      return currValue === compValue;
    },
    "~=": function (currValue, compValue) {
      if (typeof currValue !== "number" || typeof compValue !== "number") {
        return false;
      }
      return Math.round(currValue) === Math.round(compValue);
    },
    ">": function (currValue, compValue) {
      if (typeof currValue !== "number" || typeof compValue !== "number") {
        return false;
      }
      return currValue > compValue;
    },
    "<": function (currValue, compValue) {
      if (typeof currValue !== "number" || typeof compValue !== "number") {
        return false;
      }
      return currValue < compValue;
    },
    "!=": function (currValue, compValue) {
      return !this.compFuncList["=="](currValue, compValue);
    },
    "in": function (currValue, compValue) {
      if (
        typeof currValue !== "undefined" &&
        typeof compValue !== "undefined" &&
        !Array.isArray(compValue)
      ) {
        return false;
      }
      return currValue in compValue;
    },
    "notin": function (currValue, compValue) {
      return !this.compFuncList["in"](currValue, compValue);
    },
  },
};
// Initialize function for the scene manager and register the event handler
function init(tempHumidity) {
  SceneManager.setScenes(CONFIG.scenes);
  Shelly.addEventHandler(SceneManager.eventHandler, SceneManager);

  if (typeof tempHumidity !== "undefined") {
    previousHumidity = tempHumidity;
  }
  switchState = Shelly.call("Switch.GetStatus", {id: 0});
  console.log("previousHumidity: ", JSON.stringify(previousHumidity));
  console.log("tempHumidity: ", JSON.stringify(tempHumidity));
  logger("Scene Manager successfully started", "Info");
}

// Initialize with a defined humidity value
init();
