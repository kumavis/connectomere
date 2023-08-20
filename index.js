const Gpio = require('onoff').Gpio;
const out1 = new Gpio(18, 'out');
const out2 = new Gpio(23, 'out');
const out3 = new Gpio(24, 'out');
const out4 = new Gpio(25, 'out');
const in1 = new Gpio(20, 'in', 'both');
const in2 = new Gpio(21, 'in', 'both');

const allPins = [
  out1, out2, in1
]

const clocks = [
  makeClock(out1, 10, '18 blue'),
  makeClock(out2, 20, '23 white'),
  makeClock(out3, 30, '24 yellow'),
  makeClock(out4, 40, '25 red'),
]

makeReceiver(in1, '20')
makeReceiver(in2, '21')

function makeReceiver (gpioPin, label) {
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
      const rounded = Math.round(delta / 10) * 10;
      const sourceClock = clocks.find(clock => clock.interval === rounded)
      if (sourceClock) {
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
        if (lastClock !== undefined) {
          console.log(`${label}: disconnected (bad clock)`)
          lastClock = undefined
        }
      }
    }
    lastTimestamp = curr
  });
}


function makeClock (gpioPin, interval, label) {
  let value = 0
  setInterval(() => {
    value = invert(value)
    gpioPin.writeSync(value)
  }, interval)
  return { interval, label }
}

function invert (value) {
  if (value) { return 0 } else { return 1 }
}

process.on('SIGINT', _ => {
  exit()
});

// exit()

function exit () {
  allPins.forEach(pin => {
    pin.unexport()
  })
}