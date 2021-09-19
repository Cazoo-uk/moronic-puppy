import * as cdk from "@aws-cdk/core";
import * as dynamo from "@aws-cdk/dynamodb";
import { NodejsFunction } from "@aws-cdk/aws-lambda-nodejs";
import { Runtime } from "@aws-cdk/aws-lambda";

const lambdaPath = `${__dirname}/lambda`;

class ProjectorFunction extends cdk.Construct {}

export class FootballStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new dynamo.Table(this, "projectorState", {
      partitionKey: { name: "PK", type: dynamo.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamo.AttributeType.STRING },
      billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
    });

    const projectorLambda = new NodejsFunction(this, "projectorFunction", {
      entry: `${lambdaPath}/lambda.ts`,
      handler: "handler",
      memorySize: 3000,
      runtime: Runtime.NODEJS_12_X,
      timeout: cdk.Duration.minutes(15),
    });
  }
}
