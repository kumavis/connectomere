const Gpio = require('onoff').Gpio

const gadget = makeGadget(10, 10)
gadget.addOutput(18, '18 blue')
gadget.addOutput(23, '23 white')
gadget.addOutput(24, '24 yellow')
gadget.addOutput(25, '25 red')
gadget.addInput(20, '20')
gadget.addInput(21, '21')


function makeGadget (intervalStart, intervalStep) {
  const allPins = []
  const clocks = []
  const receivers = []

  const gadget = {
    addOutput (gpioPinNumber, label) {
      const gpioPin = new Gpio(gpioPinNumber, 'out');
      allPins.push(gpioPin)
      const interval = intervalStart + (clocks.length * intervalStep)
      const clock = makeClockEmitter(gpioPin, interval, label)
      clocks.push(clock)
      allPins.push(gpioPin)
      return clock
    },
    addInput (gpioPinNumber, label) {
      const gpioPin = new Gpio(gpioPinNumber, 'in', 'both');
      allPins.push(gpioPin)
      const receiver = makeReceiver(gpioPin, label, intervalStart, intervalStep, clocks)
      receivers.push(receiver)
      return receiver
    },
    exit () {
      // stop all clocks
      clocks.forEach(clock => clock.stop())
      // unexport all pins
      allPins.forEach(pin => {
        try {
          pin.unexport()
        } catch (_err) {
          // ignore error
        }
      })
    }
  }

  // exit on Ctrl-C
  process.on('SIGINT', _ => {
    gadget.exit()
  });

  return gadget
}

function makeReceiver (gpioPin, label, intervalStart, intervalStep, clocks) {
  let lastTimestamp = undefined
  let lastClock = undefined
  let timeoutRef = undefined
  gpioPin.watch((err, _value) => {
    if (err) {
      throw err;
    }
    const curr = Date.now()
    if (lastTimestamp !== undefined) {
      const delta = curr - lastTimestamp
      const rounded = intervalStart + Math.round((delta - intervalStart) / intervalStep) * intervalStep;
      const sourceClock = clocks.find(clock => clock.interval === rounded)
      // found a clock
      if (sourceClock) {
        // update connection
        if (lastClock !== sourceClock) {
          console.log(`${label}: connected ${sourceClock.label} (${delta})`)
          lastClock = sourceClock
        }
        // setup disconnect timeout
        if (timeoutRef !== undefined) clearTimeout(timeoutRef)
        timeoutRef = setTimeout(() => {
          console.log(`${label}: disconnected (timeout)`)
          lastClock = undefined
        }, sourceClock.interval * 1.5)
      } else {
        // no clock found
        if (lastClock !== undefined) {
          // set as disconnected
          console.log(`${label}: disconnected (bad clock)`)
          lastClock = undefined
        }
      }
    }
    lastTimestamp = curr
  });
}

function makeClockEmitter (gpioPin, interval, label) {
  let value = 0
  const intervalRef = setInterval(() => {
    value = invert(value)
    gpioPin.writeSync(value)
  }, interval)
  const stop = () => clearInterval(intervalRef)
  return { interval, label, stop }
}

function invert (value) {
  if (value) { return 0 } else { return 1 }
}
