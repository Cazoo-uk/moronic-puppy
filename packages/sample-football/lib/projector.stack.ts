import { Duration, Construct, Stack, StackProps } from "@aws-cdk/core";
import { SqsEventSource } from "@aws-cdk/aws-lambda-event-sources";
import { AttributeType, Table, BillingMode } from "@aws-cdk/aws-dynamodb";
import { NodejsFunction } from "@aws-cdk/aws-lambda-nodejs";
import { Code, Function, Runtime } from "@aws-cdk/aws-lambda";
import * as iam from "@aws-cdk/aws-iam";
import * as sqs from "@aws-cdk/aws-sqs";
import { EventstoreDb } from "@moronic-puppy/cdk-eventstore";

const lambdaPath = `${__dirname}/lambda`;

export interface ProjectorProps extends StackProps {}

export class ProjectionRouter extends Construct {
  private _queues: Record<string, sqs.Queue>;

  constructor(scope: Construct, id: string, db: EventstoreDb) {
    super(scope, id);
    this._queues = {};

    this._queues["goals"] = new sqs.Queue(this, "goals", {
      fifo: true,
      visibilityTimeout: Duration.minutes(15),
    });

    const router = new Function(this, "router", {
      runtime: Runtime.NODEJS_14_X,
      handler: "index.handler",
      code: Code.fromInline(`
const sdk = require('aws-sdk');
const sqs = new sdk.SQS()

function eventFromData(data) {
      const json = JSON.parse(data)
      const item = json.dynamodb.NewImage;

    return {
      id: item.ID.S,
      stream: item.PK.S,
      sequence: item.SK.N,
      type: item.TYPE.S || '',
      data: JSON.parse(item.DATA.S || ''),
    };
  }


exports.handler = async (event) => {

    const [record] = event.Records;
    const payload = Buffer.from(record.kinesis.data, 'base64');
    const e = eventFromData(payload)

      await sqs.sendMessage({
        MessageBody: record.kinesis.data,
        MessageGroupId: 'foo',
        MessageDeduplicationId: e.id,
        QueueUrl:  '${this._queues["goals"].queueUrl}'
      }).promise()
};`),
    });
    db.bindRouter(router);
    router.role?.attachInlinePolicy(
      new iam.Policy(this, "queue-write", {
        statements: [
          new iam.PolicyStatement({
            actions: ["sqs:SendMessage"],
            resources: [this._queues["goals"].queueArn],
          }),
        ],
      })
    );
  }

  public queue(name: string) {
    return this._queues[name];
  }
}

export class Projector extends Construct {
  constructor(
    scope: Construct,
    id: string,
    router: ProjectionRouter,
    db: EventstoreDb
  ) {
    super(scope, id);

    const table = new Table(this, "projectorState", {
      partitionKey: { name: "PK", type: AttributeType.STRING },
      sortKey: { name: "SK", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    const bucket = db.archive();

    const projectorLambda = new NodejsFunction(this, "projectorFunction", {
      entry: `${lambdaPath}/lambda.ts`,
      handler: "handler",
      memorySize: 3000,
      runtime: Runtime.NODEJS_12_X,
      timeout: Duration.minutes(15),
      environment: {
        ARCHIVE_BUCKET_NAME: bucket.bucketName,
        PROJECTION_TABLE: table.tableName,
      },
    });

    const listArchivePolicy = new iam.PolicyStatement({
      actions: ["s3:ListBucket"],
      resources: [bucket.bucketArn],
    });

    const readArchivePolicy = new iam.PolicyStatement({
      actions: ["s3:GetObject"],
      resources: [bucket.arnForObjects("*")],
    });

    const updateTablePolicy = new iam.PolicyStatement({
      actions: ["dynamodb:PutItem", "dynamodb:GetItem"],
      resources: [table.tableArn],
    });

    projectorLambda.role?.attachInlinePolicy(
      new iam.Policy(this, "read-policy", {
        statements: [listArchivePolicy, readArchivePolicy, updateTablePolicy],
      })
    );

    const queue = router.queue("goals");
    projectorLambda.addEventSource(new SqsEventSource(queue));
  }
}

export class ProjectorStack extends Stack {
  constructor(scope: Construct, id: string, props?: ProjectorProps) {
    super(scope, id, props);

    const db = new EventstoreDb(this, "db", {});
    const router = new ProjectionRouter(this, "router", db);
    const projector = new Projector(this, "projector", router, db);
  }
}
