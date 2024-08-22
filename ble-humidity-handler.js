const HUMIDITY_THRESHOLD = 10;
const SWITCH_ID = 0;
const BLU_MAC = "38:39:8f:70:b2:4e".toLowerCase();
const HUMIDITY_TIMEOUT = 15;
const BUTTON_TIMEOUT = 5;
const MAX_HUMIDITY_SAMPLES = 9;
const TIMER = 1;
const DEBUG = false;

let previousHumidity = null;
let switchState = false;
let humiditySamples = []; // Array(MAX_HUMIDITY_SAMPLES).fill(0)


function calculateAverageHumidity() {
    logger(["cah Humidity Samples:", humiditySamples], "Info");
    let sum = 0;
    for (let i = 1; i <= humiditySamples.length; i++) {
        sum += humiditySamples[i];
    }
    return sum / humiditySamples.length;
}

function setSwitchState(state) {
    Shelly.call("Switch.Set", { id: SWITCH_ID, on: state });
}

function startTimer(timeout) {
    logger(["startTimer", TIMER], "Info");
    Timer.clear(TIMER);
    timer = Timer.set(timeout * 60 * 1000, 
        false,
        function () {
            switchState = false;
            setSwitchState(switchState);
            logger(["Switch turned OFF (timer):", TIMER], "Info");
        },
        null);
};

function stopTimer() {
    Timer.clear(TIMER);
    logger(["Timer stopped", TIMER], "Info");
}

function handleButtonPress() {
    Shelly.call("Switch.GetStatus", { id: SWITCH_ID }, function (result, error_code, error_message) {
        if (error_code === 0) {
            switchState = !result.output;
            if (switchState) {
                console.log("Switch turned ON by button press");
                startTimer(BUTTON_TIMEOUT);
            } else {
                console.log("Switch turned OFF by button press");
                stopTimer();
            }
            setSwitchState(switchState);
        } else {
            console.log("Error getting switch status:", error_message);
        }
    });
}

function handleShellyBluEvent(eventData) {
    logger(["event received: ", JSON.stringify(eventData)], "Info");
    if (eventData.info.event === "shelly-blu") {
        const data = eventData.info.data;
        const humidity = data.humidity;
        const address = data.address;
        const button = data.button;
        if (typeof humiditySamples[0] === "undefined") {
            for (let i = 1; i <= MAX_HUMIDITY_SAMPLES; i++) {
                humiditySamples[i - 1] = data.humidity;
            }
        }
        // Calculate average humidity
        const averageHumidity = calculateAverageHumidity();

        // Update humidity samples
        if (humidity <= averageHumidity + (averageHumidity * HUMIDITY_THRESHOLD / 200)) {
            // Create a new array with one more element
            const newHumiditySamples = new Array(humiditySamples.length + 1);
            console.log("array update: ", JSON.stringify(humiditySamples), "   ", JSON.stringify(humiditySamples.length));
            // Copy existing elements
            for (let i = 1; i <= humiditySamples.length; i++) {
                newHumiditySamples[i - 1] = humiditySamples[i - 1];
            }
            console.log("copy ex newHumiditySamples: ", newHumiditySamples, " i humiditySamples: ", humiditySamples);
            // Add the new element
            cleanupData();
            console.log("uhs Humidity Samples else:", humiditySamples);

            // Check if humidity is 10% above average
            if (humidity > averageHumidity + (averageHumidity * HUMIDITY_THRESHOLD / 100)) {
                // Turn on fan
                switchState = true;
                setSwitchState(switchState);
                console.log("Started humidity switch");
                startTimer(HUMIDITY_TIMEOUT);
            } else if (humidity <= averageHumidity + 1) {
                console.log("Turned off switch - low humidity");
                if (switchState) {
                    switchState = false;
                    setSwitchState(switchState);
                    stopTimer();
                }
            }
            if (button) {
                // Handle button input
                handleButtonPress();
            }
            console.log("Shelly BLU device found", JSON.stringify(data));
            MQTT.publish("home/mbathroom/vent", JSON.stringify(data));
        } else {
            return null;
        }
    }
}
function cleanupData() {


    for (let i = 0; i < MAX_HUMIDITY_SAMPLES + 2; i++) {
        if (typeof humiditySamples[i] === "undefined" || humiditySamples[i] === "-1"|| humiditySamples[i] < 10 || humiditySamples[i] > 100) {
            humiditySamples[i] = humiditySamples[i + 1];
            humiditySamples[i + 1] = undefined;
        }
    }
    
    // Check array length after shifting
    if (humiditySamples.length > MAX_HUMIDITY_SAMPLES) {
        humiditySamples.length = MAX_HUMIDITY_SAMPLES;
    }

//        humiditySamples = trimmedHumiditySamples;
        console.log("uhs Humidity Samples 1:", humiditySamples);
        //    humiditySamples = newHumiditySamples;
        console.log("uhs Humidity Samples else:", humiditySamples);
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
            address: "38:39:8f:70:b2:4e",
        },
        ts: 1724275658.53,
    }
};

function init() {
    // Register event listener for "shelly-blu" events
    Shelly.addEventHandler(handleShellyBluEvent);
    handleButtonPress();
}

init();
