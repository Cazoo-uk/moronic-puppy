This sample uses a Kaggle dataset to generate a large-ish number of events so that we can test the projector framework.

To run the sample, download the Football Events dataset from Kaggle https://www.kaggle.com/secareanualin/football-events

Extract the files from the archive and place them in the `./data` directory, then run `node build.js`  to generate the sample input. This will result in a file `game_events.tsv`

Next, use the CDK to deploy the infrastructure for the sample.
