const Gpio = require('onoff').Gpio

module.exports = { makeGadget }

function makeGadget (intervalStart, intervalStep, log = () => {}) {
  const allPins = []
  const clocks = []
  const receivers = []
  const store = makeStore({})

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
      const receiver = makeReceiver(gpioPin, label, intervalStart, intervalStep, clocks, log)
      receivers.push(receiver)
      // update own store from children
      const updateFromChild = () => {
        const newValue = { ...store.get(), [label]: receiver.store.get() }
        store.set(newValue)
      }
      receiver.store.subscribe(_ => updateFromChild())
      // update own store now
      updateFromChild()
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
    },
    store,
  }

  // cleanup on exit
  process.on('SIGINT', _ => {
    gadget.exit()
  });

  return gadget
}

function makeReceiver (gpioPin, label, intervalStart, intervalStep, clocks, log) {
  let lastTimestamp = undefined
  const lastClock = makeStore(undefined)
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
        if (lastClock.get() !== sourceClock) {
          log(`${label}: connected ${sourceClock.label} (${delta})`)
          lastClock.set(sourceClock)
        }
        // setup disconnect timeout
        if (timeoutRef !== undefined) clearTimeout(timeoutRef)
        timeoutRef = setTimeout(() => {
          log(`${label}: disconnected (timeout)`)
          lastClock.set(undefined)
        }, sourceClock.interval * 1.5)
      } else {
        // no clock found
        if (lastClock.get() !== undefined) {
          // set as disconnected
          log(`${label}: disconnected (bad clock)`)
          lastClock.set(undefined)
        }
      }
    }
    lastTimestamp = curr
  });
  return { store: lastClock }
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

function makeStore (initialValue) {
  let value = initialValue
  const subscribers = []
  return {
    get () {
      return value
    },
    set (newValue) {
      value = newValue
      subscribers.forEach(subscriber => subscriber(newValue))
    },
    subscribe (subscriber) {
      subscribers.push(subscriber)
      const unsubscribe = () => {
        const index = subscribers.indexOf(subscriber)
        if (index !== -1) {
          subscribers.splice(index, 1)
        }
      }
      return unsubscribe
    }
  }
}
