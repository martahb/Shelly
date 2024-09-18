const HUMIDITY_THRESHOLD = 5;
const SWITCH_ID = 0;
const HUMIDITY_TIMEOUT = 20 * 1000 * 60; // 20 minutes
const BUTTON_TIMEOUT = 10 * 1000 * 60; // 10 minutes
const MAX_HUMIDITY_SAMPLES = 10;
const DEBUG = false;


let bluMac = null;
let isSwitchOn = false;
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
function setSwitchState(state) {
    Shelly.call("Switch.Set", { id: SWITCH_ID, on: state }, function (error_code, error_message) {
        if (error_code === 0) {
            isSwitchOn = state;
        } else {
            console.log("Error setting switch state:", error_message);
        }
    });
}

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

    if (isSwitchOn && buttonTriggerTime && (currentTime - buttonTriggerTime >= BUTTON_TIMEOUT)) {
        console.log("Button timeout reached. Turning off switch.");
        turnItOnAgain(false, true);
    }

    if (isSwitchOn && humidityTriggerTime && (currentTime - humidityTriggerTime >= HUMIDITY_TIMEOUT)) {
        console.log("Humidity timeout reached. Turning off switch.");
        turnItOnAgain(false, false);
    }
}

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

//
// Handles the button press event.
//
function handleButtonPress() {
    isSwitchOn = !isSwitchOn;
    turnItOnAgain(isSwitchOn, true);
}

//
// Rounds a number to the nearest integer.
//
function roundNumber(num) {

    if (num < 0) {
        // Should not round negative numbers
        return num; // Return the original number if negative
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
        average = 50; // Default value if there are no samples
    }
    return average;
}

//
// Handles Shelly Blu events and processes button or humidity data.
//
function handleShellyBluEvent(eventData) {
    if (!eventData.info || eventData.info.event !== "shelly-blu" || eventData.info.data.address !== bluMac) return;

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
            isSwitchOn = result.output;
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
            isSwitchOn = true;
            turnItOnAgain(isSwitchOn, false);
            console.log("Started humidity switch");
        }
        else if (humidity <= humiditySamples[0] && isSwitchOn) {
            console.log("Turned off switch - low humidity");
            turnItOnAgain(false, false);
        }
    }

    logger(["Shelly BLU device found ", JSON.stringify(data)], "Info");
    MQTT.publish("test", JSON.stringify(data), 0, false);
    MQTT.publish("array", JSON.stringify(humiditySamples), 0, false);
    checkTimeouts();
}

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

        if (isSwitchOn && humidity <= averageHumidity) {
            logger("Humidity dropped, turning off fan", "Info");
            turnItOnAgain(false, false); // Turn off fan if humidity drops
        } else if (!isSwitchOn && humidity > averageHumidity + HUMIDITY_THRESHOLD) {
            logger("Humidity increased, turning on fan", "Info");
            turnItOnAgain(true, false); // Turn on fan if humidity rises
        }

        // Update humidity samples
        updateHumiditySamples(humidity);

        checkTimeouts();
    }
}
//
// Updates the humidity samples.
//
function updateHumiditySamples(humidity) {
    if (humidity !== null) {
        if (humiditySamples.length === MAX_HUMIDITY_SAMPLES) {
            // Shift elements to the left manually
            for (let i = 1; i < MAX_HUMIDITY_SAMPLES; i++) {
                humiditySamples[i - 1] = humiditySamples[i];
            }
            humiditySamples[MAX_HUMIDITY_SAMPLES - 1] = humidity;
        } else if (humiditySamples.length < MAX_HUMIDITY_SAMPLES) {
            humiditySamples[humiditySamples.length] = humidity;
        }
    }
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
