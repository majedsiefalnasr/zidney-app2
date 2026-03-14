---
name: aws-serverless-eda-foundational
description: AWS serverless design principles and foundational concepts. Use when learning serverless architecture best practices, understanding AWS Well-Architected Framework principles for serverless, or setting up MCP tools. Covers core design philosophy, MCP configuration, and prerequisite knowledge before implementing patterns.
context: fork
skills:
  - aws-mcp-setup
  - aws-cdk-development
allowed-tools:
  - mcp__aws-mcp__*
  - mcp__awsdocs__*
  - mcp__cdk__*
  - Bash(aws sts get-caller-identity)
---

# AWS Serverless Design Principles & Foundations

This skill covers core design principles and foundational concepts for serverless applications on AWS.

## AWS Documentation Requirement

**CRITICAL**: This skill requires AWS MCP tools for accurate, up-to-date AWS information.

### Before Answering AWS Questions

1. **Always verify** using AWS MCP tools (if available):
   - `mcp__aws-mcp__aws___search_documentation` or `mcp__*awsdocs*__aws___search_documentation` - Search AWS docs
   - `mcp__aws-mcp__aws___read_documentation` or `mcp__*awsdocs*__aws___read_documentation` - Read specific pages
   - `mcp__aws-mcp__aws___get_regional_availability` - Check service availability

2. **If AWS MCP tools are unavailable**:
   - Guide user to configure AWS MCP using the `aws-mcp-setup` skill (auto-loaded as dependency)
   - Help determine which option fits their environment:
     - Has uvx + AWS credentials → Full AWS MCP Server
     - No Python/credentials → AWS Documentation MCP (no auth)
   - If cannot determine → Ask user which option to use

## When to Use This Skill

Use this skill when:

- Learning serverless architecture principles
- Understanding AWS Well-Architected Framework for serverless
- Setting up serverless development environment
- Evaluating serverless vs traditional architecture
- Designing for scale and resilience
- Need foundational knowledge before implementing patterns

## AWS Well-Architected Serverless Design Principles

### 1. Speedy, Simple, Singular

**Functions should be concise and single-purpose**

```typescript
// ✅ GOOD - Single purpose, focused function
export const processOrder = async (event: OrderEvent) => {
  // Only handles order processing
  const order = await validateOrder(event)
  await saveOrder(order)
  await publishOrderCreatedEvent(order)
  return { statusCode: 200, body: JSON.stringify({ orderId: order.id }) }
}

// ❌ BAD - Function does too much
export const handleEverything = async (event: any) => {
  // Handles orders, inventory, payments, shipping...
  // Too many responsibilities
}
```

**Keep functions environmentally efficient and cost-aware**:

- Minimize cold start times
- Optimize memory allocation
- Use provisioned concurrency only when needed
- Leverage connection reuse

### 2. Think Concurrent Requests, Not Total Requests

**Design for concurrency, not volume**

Lambda scales horizontally - design considerations should focus on:

- Concurrent execution limits
- Downstream service throttling
- Shared resource contention
- Connection pool sizing

```typescript
// Consider concurrent Lambda executions accessing DynamoDB
const table = new dynamodb.Table(this, 'Table', {
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Auto-scales with load
})

// Or with provisioned capacity + auto-scaling
const table = new dynamodb.Table(this, 'Table', {
  billingMode: dynamodb.BillingMode.PROVISIONED,
  readCapacity: 5,
  writeCapacity: 5,
})

// Enable auto-scaling for concurrent load
table.autoScaleReadCapacity({ minCapacity: 5, maxCapacity: 100 })
table.autoScaleWriteCapacity({ minCapacity: 5, maxCapacity: 100 })
```

### 3. Share Nothing

**Function runtime environments are short-lived**

```typescript
// ❌ BAD - Relying on local file system
export const handler = async (event: any) => {
  fs.writeFileSync('/tmp/data.json', JSON.stringify(data)) // Lost after execution
}

// ✅ GOOD - Use persistent storage
export const handler = async (event: any) => {
  await s3.putObject({
    Bucket: process.env.BUCKET_NAME,
    Key: 'data.json',
    Body: JSON.stringify(data),
  })
}
```

**State management**:

- Use DynamoDB for persistent state
- Use Step Functions for workflow state
- Use ElastiCache for session state
- Use S3 for file storage

### 4. Assume No Hardware Affinity

**Applications must be hardware-agnostic**

Infrastructure can change without notice:

- Lambda functions can run on different hardware
- Container instances can be replaced
- No assumption about underlying infrastructure

**Design for portability**:

- Use environment variables for configuration
- Avoid hardware-specific optimizations
- Test across different environments

### 5. Orchestrate with State Machines, Not Function Chaining

**Use Step Functions for orchestration**

```typescript
// ❌ BAD - Lambda function chaining
export const handler1 = async (event: any) => {
  const result = await processStep1(event)
  await lambda.invoke({
    FunctionName: 'handler2',
    Payload: JSON.stringify(result),
  })
}

// ✅ GOOD - Step Functions orchestration
const stateMachine = new stepfunctions.StateMachine(this, 'OrderWorkflow', {
  definition: stepfunctions.Chain.start(validateOrder)
    .next(processPayment)
    .next(shipOrder)
    .next(sendConfirmation),
})
```

**Benefits of Step Functions**:

- Visual workflow representation
- Built-in error handling and retries
- Execution history and debugging
- Parallel and sequential execution
- Service integrations without code

### 6. Use Events to Trigger Transactions

**Event-driven over synchronous request/response**

```typescript
// Pattern: Event-driven processing
const bucket = new s3.Bucket(this, 'DataBucket')

bucket.addEventNotification(
  s3.EventType.OBJECT_CREATED,
  new s3n.LambdaDestination(processFunction),
  { prefix: 'uploads/' }
)

// Pattern: EventBridge integration
const rule = new events.Rule(this, 'OrderRule', {
  eventPattern: {
    source: ['orders'],
    detailType: ['OrderPlaced'],
  },
})

rule.addTarget(new targets.LambdaFunction(processOrderFunction))
```

**Benefits**:

- Loose coupling between services
- Asynchronous processing
- Better fault tolerance
- Independent scaling

### 7. Design for Failures and Duplicates

**Operations must be idempotent**

```typescript
// ✅ GOOD - Idempotent operation
export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const orderId = JSON.parse(record.body).orderId

    // Check if already processed (idempotency)
    const existing = await dynamodb.getItem({
      TableName: process.env.TABLE_NAME,
      Key: { orderId },
    })

    if (existing.Item) {
      console.log('Order already processed:', orderId)
      continue // Skip duplicate
    }

    // Process order
    await processOrder(orderId)

    // Mark as processed
    await dynamodb.putItem({
      TableName: process.env.TABLE_NAME,
      Item: { orderId, processedAt: Date.now() },
    })
  }
}
```

**Implement retry logic with exponential backoff**:

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 1000))
    }
  }
  throw new Error('Max retries exceeded')
}
```

## Serverless MCP Servers Overview

This skill ecosystem leverages serverless-specific MCP servers. See `aws-serverless-eda-patterns` and `aws-serverless-eda-operations` for detailed implementation patterns and MCP usage.

---

**Related Skills**:
- `aws-serverless-eda-patterns` - Event-driven and serverless architecture patterns
- `aws-serverless-eda-operations` - Best practices, error handling, observability
