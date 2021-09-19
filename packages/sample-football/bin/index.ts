#!/usr/bin/env node
import "source-map-support/register";

import { App } from "@aws-cdk/core";

import { ProjectorStack } from "../lib/projector.stack";

const app = new App();

new ProjectorStack(app, "CdkProjectorStack");
