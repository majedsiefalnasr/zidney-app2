---
name: aws-serverless-eda-patterns
description: Event-driven and serverless architecture patterns on AWS. Use when implementing specific patterns like EventBridge routing, SQS processing, SNS pub/sub, sagas, event sourcing, microservices, stream processing, async jobs, scheduled jobs, and webhooks. Covers practical pattern implementations with code examples.
context: fork
skills:
  - aws-mcp-setup
  - aws-cdk-development
  - aws-serverless-eda-foundational
allowed-tools:
  - mcp__aws-mcp__*
  - mcp__awsdocs__*
  - mcp__cdk__*
  - Bash(sam *)
  - Bash(aws lambda *)
  - Bash(aws apigateway *)
  - Bash(aws apigatewayv2 *)
  - Bash(aws dynamodb *)
  - Bash(aws stepfunctions *)
  - Bash(aws events *)
  - Bash(aws sqs *)
  - Bash(aws sns *)
hooks:
  PreToolUse:
    - matcher: Bash(sam deploy*)
      command: aws sts get-caller-identity --query Account --output text
      once: true
---

# Event-Driven & Serverless Architecture Patterns

This skill covers practical implementation patterns for event-driven and serverless applications on AWS.

## Event-Driven Architecture Patterns

### Pattern 1: Event Router (EventBridge)

Use EventBridge for event routing and filtering:

```typescript
// Create custom event bus
const eventBus = new events.EventBus(this, 'AppEventBus', {
  eventBusName: 'application-events',
})

// Define event schema
const schema = new events.Schema(this, 'OrderSchema', {
  schemaName: 'OrderPlaced',
  definition: events.SchemaDefinition.fromInline({
    openapi: '3.0.0',
    info: { version: '1.0.0', title: 'Order Events' },
    paths: {},
    components: {
      schemas: {
        OrderPlaced: {
          type: 'object',
          properties: {
            orderId: { type: 'string' },
            customerId: { type: 'string' },
            amount: { type: 'number' },
          },
        },
      },
    },
  }),
})

// Create rules for different consumers
new events.Rule(this, 'ProcessOrderRule', {
  eventBus,
  eventPattern: {
    source: ['orders'],
    detailType: ['OrderPlaced'],
  },
  targets: [new targets.LambdaFunction(processOrderFunction)],
})

new events.Rule(this, 'NotifyCustomerRule', {
  eventBus,
  eventPattern: {
    source: ['orders'],
    detailType: ['OrderPlaced'],
  },
  targets: [new targets.LambdaFunction(notifyCustomerFunction)],
})
```

### Pattern 2: Queue-Based Processing (SQS)

Use SQS for reliable asynchronous processing:

```typescript
// Standard queue for at-least-once delivery
const queue = new sqs.Queue(this, 'ProcessingQueue', {
  visibilityTimeout: Duration.seconds(300),
  retentionPeriod: Duration.days(14),
  deadLetterQueue: {
    queue: dlq,
    maxReceiveCount: 3,
  },
})

// FIFO queue for ordered processing
const fifoQueue = new sqs.Queue(this, 'OrderedQueue', {
  fifo: true,
  contentBasedDeduplication: true,
  deduplicationScope: sqs.DeduplicationScope.MESSAGE_GROUP,
})

// Lambda consumer
new lambda.EventSourceMapping(this, 'QueueConsumer', {
  target: processingFunction,
  eventSourceArn: queue.queueArn,
  batchSize: 10,
  maxBatchingWindow: Duration.seconds(5),
})
```

### Pattern 3: Pub/Sub (SNS + SQS Fan-Out)

Implement fan-out pattern for multiple consumers:

```typescript
// Create SNS topic
const topic = new sns.Topic(this, 'OrderTopic', {
  displayName: 'Order Events',
})

// Multiple SQS queues subscribe to topic
const inventoryQueue = new sqs.Queue(this, 'InventoryQueue')
const shippingQueue = new sqs.Queue(this, 'ShippingQueue')
const analyticsQueue = new sqs.Queue(this, 'AnalyticsQueue')

topic.addSubscription(new subscriptions.SqsSubscription(inventoryQueue))
topic.addSubscription(new subscriptions.SqsSubscription(shippingQueue))
topic.addSubscription(new subscriptions.SqsSubscription(analyticsQueue))

// Each queue has its own Lambda consumer
new lambda.EventSourceMapping(this, 'InventoryConsumer', {
  target: inventoryFunction,
  eventSourceArn: inventoryQueue.queueArn,
})
```

### Pattern 4: Saga Pattern with Step Functions

Implement distributed transactions:

```typescript
const reserveFlight = new tasks.LambdaInvoke(this, 'ReserveFlight', {
  lambdaFunction: reserveFlightFunction,
  outputPath: '$.Payload',
})

const reserveHotel = new tasks.LambdaInvoke(this, 'ReserveHotel', {
  lambdaFunction: reserveHotelFunction,
  outputPath: '$.Payload',
})

const processPayment = new tasks.LambdaInvoke(this, 'ProcessPayment', {
  lambdaFunction: processPaymentFunction,
  outputPath: '$.Payload',
})

// Compensating transactions
const cancelFlight = new tasks.LambdaInvoke(this, 'CancelFlight', {
  lambdaFunction: cancelFlightFunction,
})

const cancelHotel = new tasks.LambdaInvoke(this, 'CancelHotel', {
  lambdaFunction: cancelHotelFunction,
})

// Define saga with compensation
const definition = reserveFlight
  .next(reserveHotel)
  .next(processPayment)
  .addCatch(cancelHotel.next(cancelFlight), {
    resultPath: '$.error',
  })

new stepfunctions.StateMachine(this, 'BookingStateMachine', {
  definition,
  timeout: Duration.minutes(5),
})
```

### Pattern 5: Event Sourcing

Store events as source of truth:

```typescript
// Event store with DynamoDB
const eventStore = new dynamodb.Table(this, 'EventStore', {
  partitionKey: { name: 'aggregateId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'version', type: dynamodb.AttributeType.NUMBER },
  stream: dynamodb.StreamViewType.NEW_IMAGE,
})

// Lambda function stores events
export const handleCommand = async (event: any) => {
  const { aggregateId, eventType, eventData } = event

  // Get current version
  const items = await dynamodb.query({
    TableName: process.env.EVENT_STORE,
    KeyConditionExpression: 'aggregateId = :id',
    ExpressionAttributeValues: { ':id': aggregateId },
    ScanIndexForward: false,
    Limit: 1,
  })

  const nextVersion = items.Items?.[0]?.version + 1 || 1

  // Append new event
  await dynamodb.putItem({
    TableName: process.env.EVENT_STORE,
    Item: {
      aggregateId,
      version: nextVersion,
      eventType,
      eventData,
      timestamp: Date.now(),
    },
  })
}

// Projections read from event stream
eventStore.grantStreamRead(projectionFunction)
```

## Serverless Architecture Patterns

### Pattern 1: API-Driven Microservices

REST APIs with Lambda backend:

```typescript
const api = new apigateway.RestApi(this, 'Api', {
  restApiName: 'microservices-api',
  deployOptions: {
    throttlingRateLimit: 1000,
    throttlingBurstLimit: 2000,
    tracingEnabled: true,
  },
})

// User service
const users = api.root.addResource('users')
users.addMethod('GET', new apigateway.LambdaIntegration(getUsersFunction))
users.addMethod('POST', new apigateway.LambdaIntegration(createUserFunction))

// Order service
const orders = api.root.addResource('orders')
orders.addMethod('GET', new apigateway.LambdaIntegration(getOrdersFunction))
orders.addMethod('POST', new apigateway.LambdaIntegration(createOrderFunction))
```

### Pattern 2: Stream Processing

Real-time data processing with Kinesis:

```typescript
const stream = new kinesis.Stream(this, 'DataStream', {
  shardCount: 2,
  retentionPeriod: Duration.days(7),
})

// Lambda processes stream records
new lambda.EventSourceMapping(this, 'StreamProcessor', {
  target: processFunction,
  eventSourceArn: stream.streamArn,
  batchSize: 100,
  maxBatchingWindow: Duration.seconds(5),
  parallelizationFactor: 10,
  startingPosition: lambda.StartingPosition.LATEST,
  retryAttempts: 3,
  bisectBatchOnError: true,
  onFailure: new lambdaDestinations.SqsDestination(dlq),
})
```

### Pattern 3: Async Task Processing

Background job processing:

```typescript
// SQS queue for tasks
const taskQueue = new sqs.Queue(this, 'TaskQueue', {
  visibilityTimeout: Duration.minutes(5),
  receiveMessageWaitTime: Duration.seconds(20), // Long polling
  deadLetterQueue: {
    queue: dlq,
    maxReceiveCount: 3,
  },
})

// Lambda worker processes tasks
const worker = new lambda.Function(this, 'TaskWorker', {
  // ... configuration
  reservedConcurrentExecutions: 10, // Control concurrency
})

new lambda.EventSourceMapping(this, 'TaskConsumer', {
  target: worker,
  eventSourceArn: taskQueue.queueArn,
  batchSize: 10,
  reportBatchItemFailures: true, // Partial batch failure handling
})
```

### Pattern 4: Scheduled Jobs

Periodic processing with EventBridge:

```typescript
// Daily cleanup job
new events.Rule(this, 'DailyCleanup', {
  schedule: events.Schedule.cron({ hour: '2', minute: '0' }),
  targets: [new targets.LambdaFunction(cleanupFunction)],
})

// Process every 5 minutes
new events.Rule(this, 'FrequentProcessing', {
  schedule: events.Schedule.rate(Duration.minutes(5)),
  targets: [new targets.LambdaFunction(processFunction)],
})
```

### Pattern 5: Webhook Processing

Handle external webhooks:

```typescript
// API Gateway endpoint for webhooks
const webhookApi = new apigateway.RestApi(this, 'WebhookApi', {
  restApiName: 'webhooks',
})

const webhook = webhookApi.root.addResource('webhook')
webhook.addMethod(
  'POST',
  new apigateway.LambdaIntegration(webhookFunction, {
    proxy: true,
    timeout: Duration.seconds(29), // API Gateway max
  })
)

// Lambda handler validates and queues webhook
export const handler = async (event: APIGatewayProxyEvent) => {
  // Validate webhook signature
  const isValid = validateSignature(event.headers, event.body)
  if (!isValid) {
    return { statusCode: 401, body: 'Invalid signature' }
  }

  // Queue for async processing
  await sqs.sendMessage({
    QueueUrl: process.env.QUEUE_URL,
    MessageBody: event.body,
  })

  // Return immediately
  return { statusCode: 202, body: 'Accepted' }
}
```

---

**Related Skills**:
- `aws-serverless-eda-foundational` - Design principles and foundational concepts
- `aws-serverless-eda-operations` - Best practices, error handling, observability
