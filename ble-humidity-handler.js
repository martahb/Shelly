const HUMIDITY_THRESHOLD = 5;
const SWITCH_ID = 0;
const HUMIDITY_TIMEOUT = 30 * 1000 * 60; // 30 minutes
const BUTTON_TIMEOUT = 10 * 1000 * 60; // 10 minutes
const EXTERNAL_SWITCH_TIMEOUT = 15 * 1000 * 60; // 15 minutes for external switch
const MAX_HUMIDITY_SAMPLES = 10;
const DEBUG = false;
const FALLBACK_HUMIDITY = 50;
const WHITE_MAC_ADDRESS = "7c:c6:b6:62:41:a7".toLowerCase();
const BLACK_MAC_ADDRESS = "38:39:8f:70:b2:4e".toLowerCase();

let timeout = 0;
let bluMac = null;
let isSwitchOn = false;
let humiditySamples = [];
let humidityTriggerTime = null;
let buttonTriggerTime = null;
let externalSwitchTriggerTime = null;
let averageHumidity = null;
var humidity = null;

//
// Logs the provided message if debug is enabled.
//
function logger(message, prefix) {
    if (!DEBUG) {
        return;
    }

    let finalText = "";

    // If the message is a list, loop over it
    if (Array.isArray(message)) {
        for (let i = 0; i < message.length; i++) {
            finalText = finalText + " " + JSON.stringify(message[i]);
        }
    } else {
        finalText = JSON.stringify(message);
    }

    // The prefix must be a string
    if (typeof prefix !== "string") {
        prefix = "";
    } else {
        prefix = prefix + ":";
    }

    // Log the result
    console.log(prefix, finalText);
}

//
// Sets the state of the switch.
//
function turnSwitchOn() {
    Shelly.call("Switch.Set", { id: SWITCH_ID, on: true }, function (result, error_code, error_message, userdata) {
        if (error_code === 0) {
            isSwitchOn = true;
            if (result.was_on === true) {
                console.log("Switch was already on");
            } else {
                console.log("Switch was off");
            }
        } else {
            console.log("Error setting switch state:", error_code, ", ", error_message);
        }
    });
}

function turnSwitchOff() {
    Shelly.call("Switch.Set", { id: SWITCH_ID, on: false }, function (result, error_code, error_message, userdata) {
        if (error_code !== 0) {
            console.log("Error setting switch state:", error_code, ", ", error_message);
            return;
        }

        isSwitchOn = false;
        if (result.was_on === false) {
            console.log("Switch was already off");
        }
    });
}

function checkTimeouts() {
    const currentTime = Date.now();

    if (!isSwitchOn) return;

    checkButtonTimeout(currentTime);
    checkHumidityTimeout(currentTime);
    checkExternalSwitchTimeout(currentTime);
}

function checkButtonTimeout(currentTime) {
    if (buttonTriggerTime && (currentTime - buttonTriggerTime >= BUTTON_TIMEOUT)) {
        console.log("Button timeout reached. Turning off switch.");
        turnSwitchOff();
        buttonTriggerTime = null; // Stop button timer
    }
}

function checkHumidityTimeout(currentTime) {
    if (humidityTriggerTime && (currentTime - humidityTriggerTime >= HUMIDITY_TIMEOUT)) {
        console.log("Humidity timeout reached. Turning off switch.");
        turnSwitchOff();
        humidityTriggerTime = null; // Stop humidity timer
    }
}

function checkExternalSwitchTimeout(currentTime) {
    if (externalSwitchTriggerTime && (currentTime - externalSwitchTriggerTime >= EXTERNAL_SWITCH_TIMEOUT)) {
        console.log("External switch timeout reached. Turning off switch.");
        turnSwitchOff();
        externalSwitchTriggerTime = null; // Stop external switch timer
    }
}

function cleanupData() {
    for (let i = 0; i < humiditySamples.length; i++) {
        if (typeof humiditySamples[i] !== 'number' || humiditySamples[i] < 10 || humiditySamples[i] > 100 || isNaN(humiditySamples[i])) {
            if (i > 0) {
                humiditySamples[i] = humiditySamples[i - 1];
            } else {
                humiditySamples[i] = FALLBACK_HUMIDITY; // Default to 50 if invalid
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

//
// Handles the button press event.
//
function handleButtonPress() {
    Shelly.call("Switch.Toggle", { id: SWITCH_ID }, function (result, error_code, error_message, userdata) {
        if (error_code === 0) {
            if (!result.was_on) {
                isSwitchOn = true;
                buttonTriggerTime = Date.now(); // Start humidity timer
                console.log("Switch was off");
            } else {
                isSwitchOn = false;
                buttonTriggerTime = null; // Stop humidity timer
                externalSwitchTriggerTime = null;
                console.log("Switch was on");
                for (let i = 0; i < MAX_HUMIDITY_SAMPLES; i++) {
                    humiditySamples[i] = humidity; // data.humidity;
                }
            }
        } else {
            console.log("Error setting switch state:", error_message);
        }
    });
}

//
// Rounds a number to the nearest integer.
//
function roundNumber(num) {
    if (num < 0) {
        // Should not round negative numbers
        return 0; // Return 0 if negative
    }

    // Get the integer part of the number
    let integerPart = parseInt(num, 10);

    // Get the decimal part of the number
    let decimalPart = num - integerPart;

    // If the decimal part is 0.5 or greater, round up
    if (decimalPart >= 0.5) {
        integerPart += 1;
    }
    return integerPart;
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
        average = FALLBACK_HUMIDITY; // Default value if there are no samples
    }
    return average;
}

// Update humidity samples
function updateHumiditySamples(humidity) {
    if (humidity !== null) {
        if (humiditySamples.length === MAX_HUMIDITY_SAMPLES) {
            // Shift elements to the left manually
            for (let i = 1; i < MAX_HUMIDITY_SAMPLES; i++) {
                humiditySamples[i - 1] = humiditySamples[i];
            }
            if (!isNaN(averageHumidity)) {
                humiditySamples[MAX_HUMIDITY_SAMPLES - 1] = (humidity + ((MAX_HUMIDITY_SAMPLES - 1) * averageHumidity)) / MAX_HUMIDITY_SAMPLES;
            }
        } else {
            // Manually add the new humidity value to the array
            humiditySamples[humiditySamples.length] = humidity;
        }
    }
}
function handleShellyExtStatus(statusData) {
    checkTimeouts();
    const source = statusData.delta.source;
    const id = statusData.delta.id;
    const output = statusData.delta.output;
    logger("source: ", source, "id: ", id, "output: ", output, "Info");
    if (output && id === SWITCH_ID && source === "button") {
            if (output) {
                isSwitchOn = true;
                externalSwitchTriggerTime = Date.now(); // Start external timer
            }
            else {
                            buttonTriggerTime = null; // Stop humidity timer
                            externalSwitchTriggerTime = null;
                            console.log("Switch was on");
                            for (let i = 0; i < MAX_HUMIDITY_SAMPLES; i++) {
                                humiditySamples[i] = humidity; // data.humidity;
                            }
                            isSwitchOn = false;
                        }
                    }
                else {
                    return;
                }
            }

//
// Handles Shelly Blu events and processes button or humidity data.
//
function handleShellyBluEvent(eventData) {
        if (!eventData.info || eventData.info.event !== "shelly-blu" || eventData.info.data.address !== bluMac) return;

        const data = eventData.info.data;
        humidity = data.humidity;
        const button = data.button;
        logger(["event received: ", eventData], "Info");

        // Initialize humidity samples if empty
        if (humiditySamples.length === 0) {
            for (let i = 0; i < MAX_HUMIDITY_SAMPLES; i++) {
                humiditySamples[i] = humidity; // data.humidity;
            }
        } else {
            updateHumiditySamples(humidity);
        }

        // Fetch current switch state and process data
        averageHumidity = calculateAverageHumidity();

        cleanupData();

        logger(["cleaned Humidity Samples:", humiditySamples, " ", JSON.stringify(humiditySamples.length)], "Info");

        // Check if humidity is 10% above average
        if (button) {
            // Handle button input
            handleButtonPress();
        } else {
            if (!isSwitchOn && humidity > averageHumidity + HUMIDITY_THRESHOLD) {
                // Turn on fan
                isSwitchOn = true;
                turnSwitchOn();
                humidityTriggerTime = Date.now(); // Start humidity timer
                console.log("Started humidity switch");
            }
            else if (humidity <= humiditySamples[0] && isSwitchOn) {
                console.log("Turned off switch - low humidity");
                turnSwitchOff();
                humidityTriggerTime = null; // Stop humidity timer
            }
        }

        logger(["Shelly BLU device found ", JSON.stringify(data)], "Info");
        MQTT.publish("test", JSON.stringify(data), 0, false);
        MQTT.publish("array", JSON.stringify(humiditySamples), 0, false);
        checkTimeouts();
    }



// Example event data
const eventData = {
    id: 0,
    output: true,
    source: "button"
};

function init() {
    if (Shelly.getDeviceInfo().mac === "D4D4DA352694") {
        bluMac = WHITE_MAC_ADDRESS; // white
    } else {
        bluMac = BLACK_MAC_ADDRESS; // black
    }
    console.log("koniec: ", bluMac);
    // Ensure the switch is off at startup
    turnSwitchOff();
    // Register the event handler for Shelly Blu events
    Shelly.addEventHandler(handleShellyBluEvent);
    Shelly.addStatusHandler(handleShellyExtStatus);
};

init();
