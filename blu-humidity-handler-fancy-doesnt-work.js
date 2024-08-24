const HUMIDITY_THRESHOLD = 10;
const SWITCH_ID = 0;
// const BLU_MAC = "38:39:8f:70:b2:4e".toLowerCase(); // black
const BLU_MAC = "7c:c6:b6:62:41:a7".toLowerCase(); // white
const HUMIDITY_TIMEOUT = 15;
const BUTTON_TIMEOUT = 5;
const MAX_HUMIDITY_SAMPLES = 10;
const TIMER = 1;
const DEBUG = false;

let previousHumidity = null;
let switchState = false;
let humiditySamples = [][]; // Array(MAX_HUMIDITY_SAMPLES).fill(0)
let stdDev = null;
let mod = 9;

function calculateAverageHumidity() {
    cleanupData();
//    logger(["cah Humidity length:", humiditySamples.length], "Info");
//    logger(["cah Humidity Samples:", humiditySamples], "Info");
//    logger(["cah Humidity 0:", humiditySamples[0]], "Info");
    let sum = 0;
//    console.log("0 sum: ", sum,"humiditySamples.length: ",humiditySamples.length,"humiditySamples: ",humiditySamples);
    for (let i = 0; i < humiditySamples.length; i++) {
        sum += humiditySamples[0][i];
    }
    console.log("sum: ", sum, "sum / humiditySamples.length: ", sum / humiditySamples.length );
    return sum / humiditySamples.length;
}

function setSwitchState(state) {
    Shelly.call("Switch.Set", { id: SWITCH_ID, on: state });
}

function startTimer(timeout) {
    logger(["startTimer", TIMER], "Info");
    Timer.clear(TIMER);
    timer = Timer.set(timeout * 60 * 1000, // * 60
        false,
        function () {
            switchState = false;
            setSwitchState(switchState);
            logger(["Switch turned OFF (timer):", TIMER], "Info");
        },
        null);
        Timer.clear(TIMER);
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
    // logger(["event received: ", JSON.stringify(eventData)], "Info");
    //    const TEMP = "shelly-blu";
    if (eventData.info.event !== "shelly-blu" || eventData.info.data.address !== BLU_MAC) {
        return null;
    }
    const data = eventData.info.data;
    const humidity = data.humidity;
//    const address = data.address;
    const button = data.button;

    if (typeof humiditySamples[0][0] === "undefined") {
        for (let i = 0; i < MAX_HUMIDITY_SAMPLES; i++) {
            humiditySamples[0][i] = data.humidity;
        }
    }
    // Calculate average humidity
    const averageHumidity = calculateAverageHumidity();

    if (typeof humiditySamples[1][0] === "undefined") {
    
    for (let i = 0; i < MAX_HUMIDITY_SAMPLES; i++) {
        humiditySamples[1][i] =  humiditySamples[0][i] - averageHumidity;
        humiditySamples[1][i] = humiditySamples[1][i] * humiditySamples[1][i];
    }
    for (let i = 1; i < humiditySamples.length; i++) {
        humiditySamples[1][i] =  humiditySamples[1][i] + humiditySamples[1][i -1]     
    }
    stdDev = Math.sqrt (humiditySamples[1][9] / humiditySamples.length);
    }
    // Update humidity samples
    if (!mod % 10 && humidity <= averageHumidity + stdDev) {
        console.log("!mod % 10: ",!mod % 10);
        humiditySamples[0][humiditySamples.length] = humidity;
        for (let i = 0; i < humiditySamples.length; i++) {
            humiditySamples[0][i] = humiditySamples[0][i + 1];
            humiditySamples[0][i] = humiditySamples[0][i] * humiditySamples[0][i];
            humiditySamples[1][i] = humiditySamples[1][i + 1];
            humiditySamples[1][i] = humiditySamples[1][i] * humiditySamples[1][i];

        }
    
        //humiditySamples.length--; // Equivalent to items.shift()
//        humiditySamples.length = MAX_HUMIDITY_SAMPLES;
        logger(["array update: ", humiditySamples, "   ", JSON.stringify(humiditySamples.length)], "Info");
    }
    cleanupData();
    logger(["cleaned Humidity Samples:", humiditySamples,"   ", JSON.stringify(humiditySamples.length)], "Info");

    // Check if humidity is 10% above average
    if (humidity > averageHumidity + HUMIDITY_THRESHOLD) {
        // Turn on fan
        switchState = true;
        setSwitchState(switchState);
        console.log("Started humidity switch");
        startTimer(HUMIDITY_TIMEOUT);
    }
     else if (humidity <= averageHumidity) {
        console.log("Turned off switch - low humidity");
        if (switchState) {
            // switchState = false;
            // setSwitchState(switchState);
            stopTimer();
            startTimer(BUTTON_TIMEOUT);
        }
    }
    if (button) {
        // Handle button input
        handleButtonPress();
    }
    logger(["Shelly BLU device found", JSON.stringify(data)],"Info");
    MQTT.publish("home/mbathroom/vent", JSON.stringify(data),0,false);
    MQTT.publish("home/mbathroom/test", " ", "humiditySamples",0,false);
}

function cleanupData() {


    for (let i = 0; i < MAX_HUMIDITY_SAMPLES; i++) {
        if (typeof humiditySamples[0][i] === "undefined" || humiditySamples[0][i] === "-1" || humiditySamples[0][i] < 10 || humiditySamples[0][i] > 100) {
            humiditySamples[0][i] = humiditySamples[0][i + 1];
            humiditySamples[0][i + 1] = undefined;
        }
    }

    // Check array length after shifting
    if (humiditySamples.length > MAX_HUMIDITY_SAMPLES) {
        humiditySamples.length = MAX_HUMIDITY_SAMPLES;
    }

    //        humiditySamples = trimmedHumiditySamples;
    logger(["uhs Humidity Samples 1:", humiditySamples," length: ",humiditySamples.length], "Info");
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
    setSwitchState(false);
    Shelly.addEventHandler(handleShellyBluEvent);
    //    handleButtonPress();
}

init();
