import * as cdk from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as kinesis from '@aws-cdk/aws-kinesis';
import * as firehose from '@aws-cdk/aws-kinesisfirehose';
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';

interface EventStoreProps {
  name?: string
}

class EventstoreDb extends cdk.Construct {

  private name?: string

  constructor(scope: cdk.Construct, id: string, props: EventStoreProps) {
    super(scope, id)
    this.name = props.name

    const kinesisStream = new kinesis.Stream(this, 'ChangeStream')

    const archive = this.createArchiveBucket()
    const table = this.createTable(kinesisStream)
    const delivery = this.configDelivery(kinesisStream, archive)
  }

  private createTable(kinesisStream: kinesis.Stream) {
    return new dynamodb.Table(this, 'Table', {
      tableName: `${this.name}-store`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      kinesisStream
    });
  }

  private createArchiveBucket() {
    return new s3.Bucket(this, 'ArchiveBucket', {
      bucketName: `${this.name}-archive`
    })
  }

  private configDelivery(stream: kinesis.Stream, bucket: s3.Bucket) {

    const deliveryStreamRole = new iam.Role(this, 'DeliveryRole', {
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
      }),
    );

    const hose = new firehose.CfnDeliveryStream(this, 'DeliveryStream', {
      deliveryStreamName: `${this.name}-delivery-stream`,
      deliveryStreamType: "KinesisStreamAsSource",
      kinesisStreamSourceConfiguration: {
        kinesisStreamArn: stream.streamArn,
        roleArn: deliveryStreamRole.roleArn
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

    hose.addDependsOn(deliveryStreamRole.node.defaultChild as iam.CfnRole);
    return hose;
  }
}

export class EventStoreStack extends cdk.Stack {

  db: EventstoreDb

  constructor(scope: cdk.Construct, id: string, props: cdk.StackProps = {}) {
    super(scope, id, props);
    this.db = new EventstoreDb(this, 'EventStore', {
      name: props.stackName
    })
  }
}
