# Moronic Puppy

![Moronic Puppy Architecture Diagram](/docs/architecture.png)

1. The **Event Store** (DynamoDB) holds the live events for quick, easy retrieval.
1. The **Event Stream** (Kinesis) forwards on changes from the **Event Store**.
1. Events on the **Event Stream** are pushed into the **Archive** (S3) using a Kinesis Firehose.
1. The **Router** (Lambda) iterates over the event stream and fans out to one or more **Projectors**.
1. The **Queue** (SQS FIFO Queue) holds events until they are ready to be processed by the **Projector**.
1. The **Projector** (Lambda) processes all events by first reading from the **Archive** and then the **Queue**.
