# Mars Rover Sample

This sample implements a Mars Rover kata with an event-sourced model.
The domain has three events:

* SimulationConfigured - raised when a new simulation is started
* RoverLanded - raised when a new Rover is added to the map
* RoverMoved - raised when a Rover successfully completes a series of moves

This sample uses a functional style oriented around two core functions:

`decide` takes a state and a command, and produces some events
`reduce` or `apply` takes a state and some events, and produces a new state

![decide/apply loop](https://thinkbeforecoding.com/public/FreshPaint-21-2014.01.04-10.55.10.png)
