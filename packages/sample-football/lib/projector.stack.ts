import { Duration, Construct, Stack, StackProps } from '@aws-cdk/core';
import {SqsEventSource} from '@aws-cdk/aws-lambda-event-sources';
import { AttributeType, Table, BillingMode } from '@aws-cdk/aws-dynamodb';
import { NodejsFunction } from '@aws-cdk/aws-lambda-nodejs';
import { Runtime } from '@aws-cdk/aws-lambda';
import * as iam from '@aws-cdk/aws-iam'
import * as sqs from '@aws-cdk/aws-sqs'

const lambdaPath = `${__dirname}/lambda`;

export interface ProjectorProps extends StackProps {

}

export class ProjectorStack extends Stack {

    constructor(scope: Construct, id: string, props?: ProjectorProps) {
        super(scope, id, props)

        const table = new Table(this, 'projectorState', {
            tableName: "bob-test-football-stats",
            partitionKey: { name: 'PK', type: AttributeType.STRING },
            sortKey: { name: 'SK', type: AttributeType.STRING },
            billingMode: BillingMode.PAY_PER_REQUEST,
        });

        const projectorLambda = new NodejsFunction(this, 'projectorFunction', {
            entry: `${lambdaPath}/lambda.ts`,
            handler: 'handler',
            memorySize: 3000,
            runtime: Runtime.NODEJS_12_X,
            timeout: Duration.minutes(15),
        });

        const listArchivePolicy = new iam.PolicyStatement({
            actions: ['s3:ListBucket'],
            resources: ['arn:aws:s3:::bob-eventstore-archive'],
        });

        const readArchivePolicy = new iam.PolicyStatement({
            actions: ['s3:GetObject'],
            resources: ['arn:aws:s3:::bob-eventstore-archive/*'],
        });

        const queue = sqs.Queue.fromQueueArn(this, "liveQueue", "arn:aws:sqs:eu-west-1:476912836688:bob-test-projector-goals.fifo")

        projectorLambda.role?.attachInlinePolicy(new iam.Policy(this, 's3-archive-policy', {
            statements: [listArchivePolicy, readArchivePolicy]
        }))

        projectorLambda.addEventSource(new SqsEventSource(queue))
    }
}
