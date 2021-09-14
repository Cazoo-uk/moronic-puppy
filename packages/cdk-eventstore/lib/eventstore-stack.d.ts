import * as cdk from '@aws-cdk/core';
interface EventStoreProps {
  name?: string;
}
declare class EventstoreDb extends cdk.Construct {
  private name?;
  constructor(scope: cdk.Construct, id: string, props: EventStoreProps);
  private createTable;
  private createArchiveBucket;
  private configDelivery;
}
export declare class EventStoreStack extends cdk.Stack {
  db: EventstoreDb;
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps);
}
export {};
