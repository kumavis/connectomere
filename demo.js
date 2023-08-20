main()

async function main() {
  const React = require('react');
  // const { render, Text } = require('ink');
  const { render, Box, Text } = await import('ink');
  const { makeGadget } = require('.')

  const { useSyncExternalStore } = React
  const h = React.createElement

  const gadget = makeGadget(10, 10)
  gadget.addOutput(18, '18 blue')
  gadget.addOutput(23, '23 white')
  gadget.addOutput(24, '24 yellow')
  gadget.addOutput(25, '25 red')
  gadget.addInput(20, '20')
  gadget.addInput(21, '21')

  const Display = () => {
    const gadgetState = useSyncExternalStore(gadget.store.subscribe, gadget.store.get)

    return (
      h(React.Fragment, {}, [
        ...Object.keys(gadgetState).map(key => {
          const connectedOutput = gadgetState[key]
          const outputLabel = connectedOutput ? connectedOutput.label : '(none)'
          return h(Text, { key: `input:${key}` }, [`${key}: ${outputLabel}`])
        })
      ])
    )
  };

  render(h(Display));
}

// exit on Ctrl-C
process.on('SIGINT', _ => {
  setTimeout(() => {
    process.exit(1)
  })
});