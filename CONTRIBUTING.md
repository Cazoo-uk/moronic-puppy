# Contributing

## Getting setup

Install [lerna](https://lerna.js.org/)

```
npm i -g lerna
```

Then install all dependencies using:

```
lerna bootstrap
```

## Updating documentation

1. Install the `plantuml` command line - use homebrew on OSX `brew install plantuml`.
1. Make changes to the `*.puml` files.
1. Run `npm run generate-docs` to regenerate all the pngs.
