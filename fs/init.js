// Load Mongoose OS API
load('api_gpio.js');
load('api_mqtt.js');
load('api_sys.js');
load('api_config.js');
load('api_log.js');
load('api_aws.js');
load('api_shadow.js');

let pin_led_r = Cfg.get("gpio.led.r");
let pin_led_g = Cfg.get("gpio.led.g");
let pin_led_b = Cfg.get("gpio.led.b");
let pin_button = Cfg.get("gpio.button");

let ON = 0;
let OFF = 1;

let colors = {
	red: [ON, OFF, OFF],
	yellow: [ON, ON, OFF],
	green: [OFF, ON, OFF],
	cyan: [OFF, ON, ON],
	blue: [OFF, OFF, ON],
	magenta: [ON, OFF, ON],
	white: [ON, ON, ON]
};
let states = ["on", "off"];

function aws_init() {
  AWS.Shadow.update(0, {color: Cfg.get("app.color")});
}

function change_led_color(color) {
	Log.debug("change_led_color color: " + color);
  for (let c in colors) {
    if (color === c) {
      GPIO.write(pin_led_r, colors[c][0]);
      GPIO.write(pin_led_g, colors[c][1]);
      GPIO.write(pin_led_b, colors[c][2]);
    }
  }
}

function led_on() {
	Log.debug("led_on");
	let current_color = Cfg.get("app.color");
	change_led_color(current_color);
}

function led_off() {
	Log.debug("led_off");
	GPIO.write(pin_led_r, OFF);
	GPIO.write(pin_led_g, OFF);
	GPIO.write(pin_led_b, OFF);
}

function led_init() {
	Log.debug("led_init");
	GPIO.set_mode(pin_led_r, GPIO.MODE_OUTPUT);
	GPIO.set_mode(pin_led_g, GPIO.MODE_OUTPUT);
	GPIO.set_mode(pin_led_b, GPIO.MODE_OUTPUT);

	let current_state = Cfg.get("app.state");
	if (current_state === "on") {
		led_on();
	} else {
		led_off();
	}
}

// main

led_init();

GPIO.set_button_handler(pin_button, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 50, function(x) {
	Log.info("Button pressed");
  let state = {
		color: Cfg.get("app.color"),
		state: Cfg.get("app.state")
  };
  
  let ok = AWS.Shadow.update(0, state);
  Log.debug('Published:', ok ? 'yes' : 'no', 'topic:', topic, 'state:', JSON.stringify(state));
}, true);

AWS.Shadow.setStateHandler(function(data, event, reported, desired, reported_metadata, desired_metadata) {
  if (event === AWS.Shadow.CONNECTED) {
    aws_init();
  } else if (event === AWS.Shadow.UPDATE_DELTA) {
			let device_changes = false;
			let current_config = {
				color: Cfg.get("app.color"),
				state: Cfg.get("app.state")
			};
			for (let key in desired) {
				if (key === "color" && current_config["color"] !== desired["color"]) {
					Log.debug(current_config[key],"=>",desired[key]);
					if (current_config["state"] === "on") change_led_color(desired["color"]);
					current_config["color"] = desired["color"];
					device_changes = true;
				} else if (key === "state" && current_config["state"] !== desired["state"]) {
					Log.debug(current_config[key],"=>",desired[key]);
					if (desired["state"] === "on") {
						change_led_color(current_config["color"]);
					} else if (desired["state"] === "off") {
						led_off();
					}
					current_config["state"] = desired["state"];
					device_changes = true;
				}
      }

			// Report device state
			if (device_changes) {
				Cfg.set({app: current_config});
				let ok = AWS.Shadow.update(0, current_config);
				Log.debug('Published:', ok ? 'yes' : 'no', 'reported:', JSON.stringify(current_config));
			}
  }

}, null);
