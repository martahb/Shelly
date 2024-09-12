/// <reference path="../../shelly-script.d.ts" />
const HUMIDITY_THRESHOLD = 10;
const SWITCH_ID = 0;
//const BLU_MAC = "38:39:8f:70:b2:4e".toLowerCase(); // black
const BLU_MAC = "7c:c6:b6:62:41:a7".toLowerCase(); // white
const HUMIDITY_TIMEOUT = 15 * 1000 * 60; // 15 minutes in milliseconds
const BUTTON_TIMEOUT = 5 * 1000 * 60; // 5 minutes in milliseconds
const MAX_HUMIDITY_SAMPLES = 10;
// const TIMER = 0;
// const TIMER_ON = 1;
// const TIMER_OFF = 0;
const DEBUG = false;

let switchState = false;
let humiditySamples = []; // Array(MAX_HUMIDITY_SAMPLES).fill(0)
// Variables to track when the fan was triggered
let humidityTriggerTime = null;
let buttonTriggerTime = null;
let lastHumidity = null;

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

function calculateAverageHumidity() {
    cleanupData();
    //    logger(["cah Humidity length:", humiditySamples.length], "Info");
    //    logger(["cah Humidity Samples:", humiditySamples], "Info");
    //    logger(["cah Humidity 0:", humiditySamples[0]], "Info");
    let sum = 0;
    //    console.log("0 sum: ", sum,"humiditySamples.length: ",humiditySamples.length,"humiditySamples: ",humiditySamples);
    for (let i = 0; i < humiditySamples.length; i++) {
        sum += humiditySamples[i];
    }
    console.log("sum: ", sum, "sum / humiditySamples.length: ", sum / humiditySamples.length);
    if (humiditySamples.length > 0) {
        return roundNumber(sum / humiditySamples.length);
    } else {
        return 50; // or some other default value
    }
}

function setSwitchState(state) {

    Shelly.call("Switch.Set", { id: SWITCH_ID, on: state });
}

function handleButtonPress() {
    Shelly.call("Switch.GetStatus", { id: SWITCH_ID }, function (result, error_code, error_message) {
        if (error_code === 0) {
            switchState = !result.output;
            if (switchState) {
                console.log("Switch turned ON by button press");
                buttonTriggerTime = Date.now(); // Start button timer
                setSwitchState(switchState);
            } else {
                console.log("Switch turned OFF by button press");
                buttonTriggerTime = null;
                setSwitchState(switchState);
            }
        } else {
            console.log("Error getting switch status:", error_message);
        }
    });
}


function handleShellyBluEvent(eventData) {
    // logger(["event received: ", JSON.stringify(eventData)], "Info");
    //    const TEMP = "shelly-blu";
    if (eventData.info.event !== "shelly-blu" || eventData.info.data.address !== BLU_MAC) {
        return null;
    }
    const data = eventData.info.data;
    const humidity = data.humidity;
    if (lastHumidity === null) {
        lastHumidity = humidity;
    }
    //    const address = data.address;
    const button = data.button;

    Shelly.call("Switch.GetStatus", { id: SWITCH_ID }, function (result, error_code, error_message) {
        if (error_code === 0) {
            switchState = result.output;
            if (switchState && (!buttonTriggerTime || !humidityTriggerTime)) {
                buttonTriggerTime = Date.now(); // Start button timer
            } else {
                return;
            }
        } else {
            console.log("Error getting switch status:", error_message);
        }
    });
//    if (humiditySamples.length === 0) {
//        for (let i = 0; i < MAX_HUMIDITY_SAMPLES; i++) {
//            humiditySamples[i] = humidity; // data.humidity;
//        }
//    }
    // Calculate average humidity
//    const averageHumidity = calculateAverageHumidity();

    // Update humidity samples
//    if (humiditySamples.length === MAX_HUMIDITY_SAMPLES && humidity !== null) {
        // Shift elements to the left manually
//        for (let i = 1; i < MAX_HUMIDITY_SAMPLES; i++) {
//            humiditySamples[i - 1] = humiditySamples[i];
//        }
//        if (!isNaN(averageHumidity)) {
//            humiditySamples[MAX_HUMIDITY_SAMPLES - 1] = (humidity + ((MAX_HUMIDITY_SAMPLES - 1) * averageHumidity)) / MAX_HUMIDITY_SAMPLES;
//        }
//    }

//    cleanupData();

//    logger(["cleaned Humidity Samples:", humiditySamples, "   ", JSON.stringify(humiditySamples.length)], "Info");
    // Check if humidity is 10% above average
    if (button) {
        // Handle button input
        handleButtonPress();
    } else {
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
        if (humidity && humidity > lastHumidity + HUMIDITY_THRESHOLD) {
//            // Turn on fan
            humidityTriggerTime = Date.now(); // Start humidity timer
            switchState = true;
            setSwitchState(switchState);
            console.log("Started humidity switch");
        }
        else if (humidity <= lastHumidity && switchState) {
            console.log("Turned off switch - low humidity");
            humidityTriggerTime = null;
            buttonTriggerTime = null;
            setSwitchState(!switchState);
            lastHumidity = humidity;
        }
}

    logger(["Shelly BLU device found ", JSON.stringify(data)], "Info");
    MQTT.publish("test", "JSON.stringify(data)", 0, false);
    MQTT.publish("array", JSON.stringify(lastHumidity), 0, false);
    MQTT.publish("array", JSON.stringify(lastHumidity), 0, false);
    checkTimeouts();
}

function checkTimeouts() {
    const currentTime = Date.now();
    if (switchState && buttonTriggerTime && (currentTime - buttonTriggerTime >= BUTTON_TIMEOUT)) {
        console.log("Button timeout reached. Turning off switch.");
        switchState = false;
        setSwitchState(switchState);
        buttonTriggerTime = null;
    }

    if (switchState && humidityTriggerTime && (currentTime - humidityTriggerTime >= HUMIDITY_TIMEOUT)) {
        console.log("Humidity timeout reached. Turning off switch.");
        switchState = false;
        setSwitchState(switchState);
        humidityTriggerTime = null;
    }   Date.now();
//    if (BLU_MAC === "7c:c6:b6:62:41:a7") {
//        return;
//    }
}

function cleanupData() {
    for (let i = 0; i < humiditySamples.length; i++) {
        if (typeof humiditySamples[i] === "undefined" || humiditySamples[i] === "-1" || humiditySamples[i] < 10 || humiditySamples[i] > 100 || typeof humiditySamples[i] !== 'number' || isNaN(humiditySamples[i])) {
            humiditySamples[i] = (i > 0) ? humiditySamples[i - 1] : 50;
        } else if (humiditySamples[i] === null) {
            humiditySamples[i] = humiditySamples[i - 1];
        }
    }

    if (humiditySamples.length > MAX_HUMIDITY_SAMPLES) {
        humiditySamples.length = MAX_HUMIDITY_SAMPLES;
    }

    //        humiditySamples = trimmedHumiditySamples;
    logger(["uhs Humidity Samples 1:", humiditySamples, " length: ", humiditySamples.length], "Info");
    //    humiditySamples = newHumiditySamples;
    //        console.log("uhs Humidity Samples else:", humiditySamples);
}


// Logs the provided message with an optional prefix to the console
function logger(message, prefix) {
    //exit if the debug isn't enabled
    if (!DEBUG) {
        return;
    }

    let finalText = "";

    //if the message is list loop over it
    if (Array.isArray(message)) {
        for (let i = 0; i < message.length; i++) {
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

// Example event data
const event = {
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
    // MQTT.SetConfig(enable,10.20.30.10,"shelly-blu","DVES_USER",null,null,false,false,false,false);
    // Register event listener for "shelly-blu" events
    //    setSwitchState(false);
    setSwitchState(false);
    Shelly.addEventHandler(handleShellyBluEvent);
    //    handleButtonPress();
    //    setInterval(checkTimeouts, 1000); // Check timeouts every second
}

init();
