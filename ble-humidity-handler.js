const HUMIDITY_THRESHOLD = 10;
const SWITCH_ID = 0;
const BLU_MAC = "38:39:8f:70:b2:4e".toLowerCase();
const HUMIDITY_TIMEOUT = 15;
const BUTTON_TIMEOUT = 5;
const MAX_HUMIDITY_SAMPLES = 9;
const TIMER = 1;

let previousHumidity = null;
let switchState = false;
let buttonTimer = null;
let humidityTimer = null;
let lowHumidity = 50;
//let humiditySamples = Array(MAX_HUMIDITY_SAMPLES).fill(0);
//let timerObj = null;
//let buttonTimer = null;


//function calculateAverageHumidity() {
//    return humiditySamples.reduce((sum, current) => sum + current, 0) / humiditySamples.length;
//}

function isHumidityHigh(humidity) {
//    return humidity > calculateAverageHumidity() + HUMIDITY_THRESHOLD;
    return humidity > previousHumidity + HUMIDITY_THRESHOLD;
}

function isHumidityLow(humidity) {
    return humidity <= previousHumidity + 1;
}

//function updateHumiditySamples(humidity) {
//    humiditySamples.push(humidity);
//    if (humiditySamples.length > MAX_HUMIDITY_SAMPLES) {
//        humiditySamples.shift();
//    }
//}

function setSwitchState(state) {
    Shelly.call("Switch.Set", { id: SWITCH_ID, on: state });
}

function startTimer(timerObj, timeout) {
    console.log('startTimer: ', timerObj);
    Timer.clear(timerObj);
    timerObj = Timer.set(timeout * 60 * 1000, false, function () {
    switchState = false;
    setSwitchState(switchState);
      console.log('Switch turned OFF (timer): ', timerObj);
    }, null);
  }

  function stopTimer(timerObj) {
    console.log('stopTimer: ', timerObj);
    Timer.clear(timerObj);
  }

function handleHumidity(data) {
    const humidity = data.humidity;
    Shelly.call("Switch.GetStatus", { id: SWITCH_ID }, function (result, error_code, error_message) {
        if (error_code === 0) {
            switchState = result.output;
            if (switchState) {
                startTimer(TIMER,HUMIDITY_TIMEOUT);
            } else {
                stopTimer(TIMER);
            }
        } else {
            console.log("Error getting switch status:", error_message);
        }
    });
}

function handleHighHumidity() {
    console.log('Turning switch ON due to high humidity');
    switchState = true;
    setSwitchState(switchState);
    stopTimer(TIMER);
    startTimer(TIMER,HUMIDITY_TIMEOUT);
}

function handleLowHumidity(data) {
    console.log('Turning switch OFF due to low humidity');
//    updateHumiditySamples(data.humidity);
    previousHumidity = humidity;
    switchState = false;
    setSwitchState(switchState);
    stopTimer(TIMER);
 }

function handleButtonPress() {
    Shelly.call("Switch.GetStatus", { id: SWITCH_ID }, function (result, error_code, error_message) {
        if (error_code === 0) {
            switchState = !result.output;
            if (switchState) {
                console.log('Switch turned ON by button press');
                stopTimer(TIMER);
                startTimer(TIMER,HUMIDITY_TIMEOUT);
            } else {
                console.log('Switch turned OFF by button press');
                stopTimer(TIMER);
            }
            setSwitchState(switchState);
        } else {
            console.log("Error getting switch status:", error_message);
        }
    });
}

let CONFIG = {
    scenes: [
        {
            conditions: { event: "shelly-blu", address: BLU_MAC, button: { compare: ">", value: 0 } },
            action: handleButtonPress
        },
        {
            conditions: { event: "shelly-blu", address: BLU_MAC, humidity: isHumidityLow },
            action: handleLowHumidity
        },
        {
            conditions: { event: "shelly-blu", address: BLU_MAC, humidity: isHumidityHigh },
            action: handleHighHumidity
        },
        {
            conditions: { event: "shelly-blu", address: BLU_MAC },
            action: function (data) {
                console.log("Shelly BLU device found", JSON.stringify(data));
                MQTT.publish("home/mbathroom/vent", JSON.stringify(data));
            }
        }
    ],
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
