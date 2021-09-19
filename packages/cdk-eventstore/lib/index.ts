import * as cdk from "@aws-cdk/core";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as kinesis from "@aws-cdk/aws-kinesis";
import * as firehose from "@aws-cdk/aws-kinesisfirehose";
import * as s3 from "@aws-cdk/aws-s3";
import * as iam from "@aws-cdk/aws-iam";
import { Function, StartingPosition } from "@aws-cdk/aws-lambda";
import { KinesisEventSource } from "@aws-cdk/aws-lambda-event-sources";

export interface EventStoreProps {
  name?: string;
}

export class EventstoreDb extends cdk.Construct {
  private name?: string;
  private _deliveryStream: kinesis.Stream;
  private _archive: s3.Bucket;

  constructor(scope: cdk.Construct, id: string, props: EventStoreProps) {
    super(scope, id);
    this.name = props.name;

    this._deliveryStream = new kinesis.Stream(this, "ChangeStream");

    this._archive = this.createArchiveBucket();
    const table = this.createTable(this._deliveryStream);
    const delivery = this.configDelivery(this._deliveryStream, this._archive);
  }

  public archive() {
    return this._archive;
  }

  public bindRouter(fn: Function) {
    fn.addEventSource(
      new KinesisEventSource(this._deliveryStream, {
        startingPosition: StartingPosition.LATEST,
      })
    );
  }

  private createTable(kinesisStream: kinesis.Stream) {
    return new dynamodb.Table(this, "Table", {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      kinesisStream,
    });
  }

  private createArchiveBucket() {
    return new s3.Bucket(this, "ArchiveBucket", {});
  }

  private createArchiveReadPolicy(bucket: s3.Bucket) {
    return new iam.Policy(this, "read-policy", {});
  }

  private configDelivery(stream: kinesis.Stream, bucket: s3.Bucket) {
    const deliveryStreamRole = new iam.Role(this, "DeliveryRole", {
      assumedBy: new iam.ServicePrincipal("firehose.amazonaws.com"),
    });
    stream.grantRead(deliveryStreamRole);

    deliveryStreamRole.addToPolicy(
      new iam.PolicyStatement({
        resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
        actions: [
          "s3:AbortMultipartUpload",
          "s3:GetBucketLocation",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:ListBucketMultipartUploads",
          "s3:PutObject",
        ],
      })
    );

    const firehosePolicy = new iam.Policy(this, "FirehosePolicy", {
      roles: [deliveryStreamRole],
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          resources: [stream.streamArn],
          actions: [
            "kinesis:DescribeStream",
            "kinesis:GetShardIterator",
            "kinesis:GetRecords",
          ],
        }),
      ],
    });

    const hose = new firehose.CfnDeliveryStream(this, "DeliveryStream", {
      deliveryStreamType: "KinesisStreamAsSource",
      kinesisStreamSourceConfiguration: {
        kinesisStreamArn: stream.streamArn,
        roleArn: deliveryStreamRole.roleArn,
      },
      s3DestinationConfiguration: {
        bucketArn: bucket.bucketArn,
        bufferingHints: {
          intervalInSeconds: 300,
          sizeInMBs: 2,
        },
        compressionFormat: "GZIP",
        roleArn: deliveryStreamRole.roleArn,
      },
    });

    hose.node.addDependency(deliveryStreamRole);
    return hose;
  }
}
