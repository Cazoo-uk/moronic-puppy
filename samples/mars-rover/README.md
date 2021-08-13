# Mars Rover Sample

This sample implements a Mars Rover kata with an event-sourced model.
The domain has three commands:

* Start - create a new simulation and set the size of the planet
* Land - add a new rover to the planet
* Move - submit a series of commands to the rover

Those commands correlate to three events:

* SimulationConfigured - raised when a new simulation is started
* RoverLanded - raised when a new Rover is added to the map
* RoverMoved - raised when a Rover successfully completes a series of moves

This sample uses a functional style oriented around two core functions:

* `decide` takes a state and a command, and produces some events
* `reduce` or `apply` takes a state and some events, and produces a new state

![decide/apply loop](https://thinkbeforecoding.com/public/FreshPaint-21-2014.01.04-10.55.10.png)

If you fancy extending the sample, start by making the x/y coordinate wrap around so that the rover can't move infinitely off the edge of the planet. 

Try implementing collision detection. Add a new command `addObstacle` and write a decide for it. Should you be able to add an obstacle once the simulation is running? Should you be able to resize the planet once you've added obstacles?

Update the move command so that if the rover encounters an obstacle, it stops the move early. Return two events, [`RoverMoved(new position)`, `ObstacleDetected(obstacle position)`].

At the moment, moves are atomic - either the whole move succeeds or fails if the instruction string is invalid. Ideally, an invalid instruction string should still fail even if there's an obstacle on the way.
