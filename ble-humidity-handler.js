/// <reference path="../../shelly-script.d.ts" />
const HUMIDITY_THRESHOLD = 5;
const SWITCH_ID = 0;
const HUMIDITY_TIMEOUT = 20 * 1000 * 60; // 20 minutes
const BUTTON_TIMEOUT = 10 * 1000 * 60; // 10 minutes
const MAX_HUMIDITY_SAMPLES = 10;
const DEBUG = false;

let bluMac = null;
let switchState = false;
let humiditySamples = [];
let humidityTriggerTime = null;
let buttonTriggerTime = null;


//
// Logs the provided message if debug is enabled.
//
function logger(message, prefix) {
    if (!DEBUG) {
        return;
    }

    let finalText = "";

    //if the message is list loop over it
    if (Array.isArray(message)) {
        for (let i = 0; i < message.length; i++) {
//            finalText += " " + JSON.stringify(message[i]);
            finalText = finalText + " " + JSON.stringify(message[i]);
        }
    } else {
        finalText = JSON.stringify(message);
    }

    //the prefix must be string
    if (typeof prefix !== "string") {
        prefix = "";
    } else {
        prefix = prefix + ":";
    }

    //log the result
    console.log(prefix, finalText);
}

//
// Sets the state of the switch.
//
function setSwitchState(state) {
    //    return new Promise((resolve, reject) => {
    Shelly.call("Switch.Set", { id: SWITCH_ID, on: state }, function (result, error_code, error_message) {
        if (error_code === 0) {
            switchState = state;
            //            resolve();
        } else {
            console.log("Error setting switch state:", error_message);
            //              reject(error_message);
        }
    });
}
//function setSwitchState(state) {
//
//    Shelly.call("Switch.Set", { id: SWITCH_ID, on: state });
//}

// Turns the fan on or off based on the input and whether the action is triggered by a button press or humidity level.
// 
// @param {boolean} input - The desired state of the fan (true for on, false for off).
// @param {boolean} isButton - Indicates if the action is triggered by a button press (true) or by humidity level (false).
//
function turnItOnAgain(turnOn, isButton) {
    setSwitchState(turnOn);
    if (isButton) {
        if (turnOn) {
            buttonTriggerTime = Date.now(); // Start button timer
            console.log("Started manual switch");
        } else {
            buttonTriggerTime = null; // Stop button timer
            console.log("Manual timer stopped");
        }
    } else {
        if (turnOn) {
            humidityTriggerTime = Date.now(); // Start humidity timer
            console.log("Started humidity switch");
        } else {
            humidityTriggerTime = null; // Stop humidity timer
            console.log("Humidity timer stopped");
        }
    }
}

// Checks if any timeout has been reached and turns off the switch if needed.
function checkTimeouts() {
    const currentTime = Date.now();

    if (switchState && buttonTriggerTime && (currentTime - buttonTriggerTime >= BUTTON_TIMEOUT)) {
        console.log("Button timeout reached. Turning off switch.");
        turnItOnAgain(false, true);
    }

    if (switchState && humidityTriggerTime && (currentTime - humidityTriggerTime >= HUMIDITY_TIMEOUT)) {
        console.log("Humidity timeout reached. Turning off switch.");
        turnItOnAgain(false, false);
    }
}

//function checkTimeouts() {
//    const currentTime = Date.now();
//    if (switchState && buttonTriggerTime && (currentTime - buttonTriggerTime >= BUTTON_TIMEOUT)) {
//        console.log("Button timeout reached. Turning off switch.");
//        switchState = false;
//        setSwitchState(switchState);
//        buttonTriggerTime = null;
//    }
//
//    if (switchState && humidityTriggerTime && (currentTime - humidityTriggerTime >= HUMIDITY_TIMEOUT)) {
//        console.log("Humidity timeout reached. Turning off switch.");
//        switchState = false;
//        setSwitchState(switchState);
//        humidityTriggerTime = null;
//    }   Date.now();
////    if (BLU_MAC === "7c:c6:b6:62:41:a7") {
////        return;
////    }
//}

function cleanupData() {
    for (let i = 0; i < humiditySamples.length; i++) {
        if (typeof humiditySamples[i] !== 'number' || humiditySamples[i] < 10 || humiditySamples[i] > 100 || isNaN(humiditySamples[i])) {
            if (i > 0) {
                humiditySamples[i] = humiditySamples[i - 1];
            } else {
                humiditySamples[i] = 50; // Default to 50 if invalid
            }
        }
    }

    // Adjust the length of the array
    if (humiditySamples.length > MAX_HUMIDITY_SAMPLES) {
        let newArray = [];
        for (let i = 0; i < MAX_HUMIDITY_SAMPLES; i++) {
            newArray[i] = humiditySamples[i];
        }
        humiditySamples = newArray;
    }

    logger(["cleaned Humidity Samples:", humiditySamples], "Info");
}
//function cleanupData() {
//    for (let i = 0; i < humiditySamples.length; i++) {
//        if (typeof humiditySamples[i] === "undefined" || humiditySamples[i] === "-1" || humiditySamples[i] < 10 || humiditySamples[i] > 100 || typeof humiditySamples[i] !== 'number' || isNaN(humiditySamples[i])) {
//            humiditySamples[i] = (i > 0) ? humiditySamples[i - 1] : 50;
//        } else if (humiditySamples[i] === null) {
//            humiditySamples[i] = humiditySamples[i - 1];
//        }
//    }
//
//    if (humiditySamples.length > MAX_HUMIDITY_SAMPLES) {
//        humiditySamples.length = MAX_HUMIDITY_SAMPLES;
//    }
//
//    //        humiditySamples = trimmedHumiditySamples;
//    logger(["uhs Humidity Samples 1:", humiditySamples, " length: ", humiditySamples.length], "Info");
//    //    humiditySamples = newHumiditySamples;
//    //        console.log("uhs Humidity Samples else:", humiditySamples);
//}

//
// Handles the button press event.
//
function handleButtonPress() {
    switchState = !switchState;
    turnItOnAgain(switchState, true);
}

//function handleButtonPress() {
//    Shelly.call("Switch.GetStatus", { id: SWITCH_ID }, function (result, error_code, error_message) {
//        if (error_code === 0) {
//            switchState = !result.output;
//            if (switchState) {
//                console.log("Switch turned ON by button press");
//                buttonTriggerTime = Date.now(); // Start button timer
//                setSwitchState(switchState);
//            } else {
//                console.log("Switch turned OFF by button press");
//                buttonTriggerTime = null;
//                setSwitchState(switchState);
//            }
//        } else {
//            console.log("Error getting switch status:", error_message);
//        }
//    });
//}

//
// Rounds a number to the nearest integer.
//
//function roundNumber(num) {
//    const integerPart = parseInt(num, 10);
//    const decimalPart = num - integerPart;
//
//    // If the decimal part is 0.5 or greater, round up
//    if (decimalPart >= 0.5) {
//        integerPart += 1;
//    }
//
//    return integerPart;
//}
function roundNumber(num) {
    // Check if the number is negative
    let isNegative = num < 0;

    // Take the absolute value of the number
    num = isNegative ? -num : num;

    // Get the integer part of the number
    let integerPart = parseInt(num, 10);

    // Get the decimal part of the number
    let decimalPart = num - integerPart;

    // If the decimal part is 0.5 or greater, round up
    if (decimalPart >= 0.5) {
        integerPart += 1;
    }

    // Restore the sign if the number was negative
    return isNegative ? -integerPart : integerPart;
}

//
// Calculates the average humidity from the samples.
//
function calculateAverageHumidity() {
    cleanupData();
    let sum = 0;
    for (let i = 0; i < humiditySamples.length; i++) {
        sum += humiditySamples[i];
    }
    let average;
    if (humiditySamples.length > 0) {
        average = roundNumber(sum / humiditySamples.length);
    } else {
        average = 50; // Default value if there are no samples
    }
    return average;
}
//function calculateAverageHumidity() {
//    cleanupData();
//    //    logger(["cah Humidity length:", humiditySamples.length], "Info");
//    //    logger(["cah Humidity Samples:", humiditySamples], "Info");
//    //    logger(["cah Humidity 0:", humiditySamples[0]], "Info");
//    let sum = 0;
//    //    console.log("0 sum: ", sum,"humiditySamples.length: ",humiditySamples.length,"humiditySamples: ",humiditySamples);
//    for (let i = 0; i < humiditySamples.length; i++) {
//        sum += humiditySamples[i];
//    }
//    console.log("sum: ", sum, "sum / humiditySamples.length: ", sum / humiditySamples.length);
//    if (humiditySamples.length > 0) {
//        return roundNumber(sum / humiditySamples.length);
//    } else {
//        return 50; // or some other default value
//    }
//}
//
// Handles Shelly Blu events and processes button or humidity data.
//
function handleShellyBluEvent(eventData) {
    if (eventData.info.event !== "shelly-blu" || eventData.info.data.address !== bluMac) return;

    const data = eventData.info.data;
    const humidity = data.humidity;
    const button = data.button;
    logger(["event received: ", eventData], "Info");

    // Initialize humidity samples if empty
    if (humiditySamples.length === 0) {
        for (let i = 0; i < MAX_HUMIDITY_SAMPLES; i++) {
            humiditySamples[i] = humidity; // data.humidity;
        }
    }

    // Fetch current switch state and process data
    Shelly.call("Switch.GetStatus", { id: SWITCH_ID }, function (result, error_code, error_message) {
        if (error_code === 0) {
            switchState = result.output;
//            processEvent(button, humidity); // Move processEvent here
        } else {
            console.log("Error getting switch status:", error_message);
        }
    });
    // Calculate average humidity
    const averageHumidity = calculateAverageHumidity();

    // Update humidity samples
    if (humiditySamples.length === MAX_HUMIDITY_SAMPLES && humidity !== null) {
        // Shift elements to the left manually
        for (let i = 1; i < MAX_HUMIDITY_SAMPLES; i++) {
            humiditySamples[i - 1] = humiditySamples[i];
        }
        if (!isNaN(averageHumidity)) {
            humiditySamples[MAX_HUMIDITY_SAMPLES - 1] = (humidity + ((MAX_HUMIDITY_SAMPLES - 1) * averageHumidity)) / MAX_HUMIDITY_SAMPLES;
        }
    }

    cleanupData();

    logger(["cleaned Humidity Samples:", humiditySamples, " ", JSON.stringify(humiditySamples.length)], "Info");

    // Check if humidity is 10% above average
    if (button) {
        // Handle button input
        handleButtonPress();
    } else {
        if (humidity > averageHumidity + HUMIDITY_THRESHOLD) {
            // Turn on fan
            switchState = true;
            turnItOnAgain(switchState,false);
            console.log("Started humidity switch");
        }
        else if (humidity <= humiditySamples[0] && switchState) {
            console.log("Turned off switch - low humidity");
//            humidityTriggerTime = null;
//            buttonTriggerTime = null;
//            setSwitchState(!switchState);
            turnItOnAgain(false, false);
        }
    }

    logger(["Shelly BLU device found ", JSON.stringify(data)], "Info");
    MQTT.publish("test", "JSON.stringify(data)", 0, false);
    MQTT.publish("array", JSON.stringify(humiditySamples), 0, false);
    MQTT.publish("array", JSON.stringify(humiditySamples), 0, false);
    checkTimeouts();
}
//function handleShellyBluEvent(eventData) {
//    // logger(["event received: ", JSON.stringify(eventData)], "Info");
//    //    const TEMP = "shelly-blu";
//    if (eventData.info.event !== "shelly-blu" || eventData.info.data.address !== BLU_MAC) {
//        return null;
//    }
//    const data = eventData.info.data;
//    const humidity = data.humidity;
//    //    const address = data.address;
//    const button = data.button;
//
//    Shelly.call("Switch.GetStatus", { id: SWITCH_ID }, function (result, error_code, error_message) {
//        if (error_code === 0) {
//            switchState = result.output;
//            if (switchState && (!buttonTriggerTime || !humidityTriggerTime)) {
//                buttonTriggerTime = Date.now(); // Start button timer
//            } else {
//                return;
//            }
//        } else {
//            console.log("Error getting switch status:", error_message);
//        }
//    });
//    if (humiditySamples.length === 0) {
//        for (let i = 0; i < MAX_HUMIDITY_SAMPLES; i++) {
//            humiditySamples[i] = humidity; // data.humidity;
//        }
//    }
//    // Calculate average humidity
//    const averageHumidity = calculateAverageHumidity();
//
//    // Update humidity samples
//    if (humiditySamples.length === MAX_HUMIDITY_SAMPLES && humidity !== null) {
//        // Shift elements to the left manually
//        for (let i = 1; i < MAX_HUMIDITY_SAMPLES; i++) {
//            humiditySamples[i - 1] = humiditySamples[i];
//        }
//        if (!isNaN(averageHumidity)) {
//            humiditySamples[MAX_HUMIDITY_SAMPLES - 1] = (humidity + ((MAX_HUMIDITY_SAMPLES - 1) * averageHumidity)) / MAX_HUMIDITY_SAMPLES;
//        }
//    }
//
//    cleanupData();
//
//    logger(["cleaned Humidity Samples:", humiditySamples, "   ", JSON.stringify(humiditySamples.length)], "Info");
//
//    // Check if humidity is 10% above average
//    if (button) {
//        // Handle button input
//        handleButtonPress();
//    } else {
//        if (humidity > averageHumidity + HUMIDITY_THRESHOLD) {
//            // Turn on fan
//            humidityTriggerTime = Date.now(); // Start humidity timer
//            switchState = true;
//            setSwitchState(switchState);
//            console.log("Started humidity switch");
//        }
//        else if (humidity <= humiditySamples[0] && switchState) {
//            console.log("Turned off switch - low humidity");
//            humidityTriggerTime = null;
//            buttonTriggerTime = null;
//            setSwitchState(!switchState);
//        }
//    }
//
//    logger(["Shelly BLU device found ", JSON.stringify(data)], "Info");
//    MQTT.publish("test", "JSON.stringify(data)", 0, false);
//    MQTT.publish("array", JSON.stringify(humiditySamples), 0, false);
//    MQTT.publish("array", JSON.stringify(humiditySamples), 0, false);
//    checkTimeouts();
//}

//
// Processes button and humidity events.
//
function processEvent(button, humidity) {
    logger(["Processing event with button:", button, "humidity:", humidity], "Info");

    if (button) {
        logger("Button press detected", "Info");
        handleButtonPress();
    } else {
        const averageHumidity = calculateAverageHumidity();
        logger(["Average humidity calculated:", averageHumidity], "Info");

        if (switchState && humidity <= averageHumidity) {
            logger("Humidity dropped, turning off fan", "Info");
            turnItOnAgain(false, false); // Turn off fan if humidity drops
        } else if (!switchState && humidity > averageHumidity + HUMIDITY_THRESHOLD) {
            logger("Humidity increased, turning on fan", "Info");
            turnItOnAgain(true, false); // Turn on fan if humidity rises
        }

        // Update humidity samples
        updateHumiditySamples(humidity);

        // cleanupData();
        checkTimeouts();
    }
}
//
// Updates the humidity samples.
//
function updateHumiditySamples(humidity) {
    if (humiditySamples.length === MAX_HUMIDITY_SAMPLES) {
        // Shift elements to the left manually
        for (let i = 1; i < MAX_HUMIDITY_SAMPLES; i++) {
            if (humidity !== null) {
                humiditySamples[i - 1] = humiditySamples[i];
            }
        }
        humiditySamples[MAX_HUMIDITY_SAMPLES - 1] = humidity;
    } else if (humiditySamples.length < MAX_HUMIDITY_SAMPLES) {
        humiditySamples[humiditySamples.length] = humidity;
    }
    print(bluMac);
}

// Example event data
const eventData = {
    component: "script:1",
    name: "script",
    id: 1,
    now: 1724280608.34067416191,
    info: {
        component: "script:1",
        id: 1,
        event: "shelly-blu",
        data: {
            encryption: false,
            BTHome_version: 2,
            pid: 169,
            battery: 100,
            humidity: 50,
            button: 1,
            temperature: 31.5,
            rssi: -81,
            address: "7c:c6:b6:62:41:a7",
        },
        ts: 1724275658.53,
    }
};

function init() {
    // Check the device MAC address and set the corresponding bluMac address
    // Ensure the switch is off at startup
    // Register the event handler for Shelly Blu events
    if (Shelly.getDeviceInfo().mac === "D4D4DA352694") {
        bluMac = "7c:c6:b6:62:41:a7".toLowerCase(); // white
    } else {
        bluMac = "38:39:8f:70:b2:4e".toLowerCase(); // black
    }
    setSwitchState(false); // Ensure switch is off at startup
    Shelly.addEventHandler(handleShellyBluEvent);
}

init();
