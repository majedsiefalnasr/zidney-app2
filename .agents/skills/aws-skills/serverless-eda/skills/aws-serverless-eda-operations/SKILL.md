---
name: aws-serverless-eda-operations
description: Serverless operations, best practices, and MCP integration. Use when implementing error handling, dead letter queues, observability, tracing, monitoring, and testing serverless applications. Covers operational concerns and production readiness patterns.
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
  - Bash(aws cloudwatch *)
  - Bash(aws sqs *)
  - Bash(aws sns *)
---

# Serverless Operations & Best Practices

This skill covers operational concerns, error handling, observability, and production readiness for serverless applications.

## Best Practices

### Error Handling

**Implement comprehensive error handling**:

```typescript
export const handler = async (event: SQSEvent) => {
  const failures: SQSBatchItemFailure[] = []

  for (const record of event.Records) {
    try {
      await processRecord(record)
    } catch (error) {
      console.error('Failed to process record:', record.messageId, error)
      failures.push({ itemIdentifier: record.messageId })
    }
  }

  // Return partial batch failures for retry
  return { batchItemFailures: failures }
}
```

### Dead Letter Queues

**Always configure DLQs for error handling**:

```typescript
const dlq = new sqs.Queue(this, 'DLQ', {
  retentionPeriod: Duration.days(14),
})

const queue = new sqs.Queue(this, 'Queue', {
  deadLetterQueue: {
    queue: dlq,
    maxReceiveCount: 3,
  },
})

// Monitor DLQ depth
new cloudwatch.Alarm(this, 'DLQAlarm', {
  metric: dlq.metricApproximateNumberOfMessagesVisible(),
  threshold: 1,
  evaluationPeriods: 1,
  alarmDescription: 'Messages in DLQ require attention',
})
```

### Observability

**Enable tracing and monitoring**:

```typescript
new NodejsFunction(this, 'Function', {
  entry: 'src/handler.ts',
  tracing: lambda.Tracing.ACTIVE, // X-Ray tracing
  environment: {
    POWERTOOLS_SERVICE_NAME: 'order-service',
    POWERTOOLS_METRICS_NAMESPACE: 'MyApp',
    LOG_LEVEL: 'INFO',
  },
})
```

## Using MCP Servers Effectively

### AWS Serverless MCP Server

**Purpose**: Complete serverless application lifecycle with SAM CLI

- Initialize new serverless applications
- Deploy serverless applications
- Test Lambda functions locally
- Generate SAM templates
- Manage serverless application lifecycle

**Lifecycle management**:

- Initialize new serverless projects
- Generate SAM templates
- Deploy applications
- Test locally before deployment

### AWS Lambda Tool MCP Server

**Purpose**: Execute Lambda functions as tools

- Invoke Lambda functions directly
- Test Lambda integrations
- Execute workflows requiring private resource access
- Run Lambda-based automation

**Function execution**:

- Test Lambda functions directly
- Execute automation workflows
- Access private resources
- Validate integrations

### AWS Step Functions MCP Server

**Purpose**: Execute complex workflows and orchestration

- Create and manage state machines
- Execute workflow orchestrations
- Handle distributed transactions
- Implement saga patterns
- Coordinate microservices

**Workflow orchestration**:

- Create state machines for complex workflows
- Execute distributed transactions
- Implement saga patterns
- Coordinate microservices

### Amazon SNS/SQS MCP Server

**Purpose**: Event-driven messaging and queue management

- Publish messages to SNS topics
- Send/receive messages from SQS queues
- Manage event-driven communication
- Implement pub/sub patterns
- Handle asynchronous processing

**Messaging operations**:

- Test pub/sub patterns
- Send test messages to queues
- Validate event routing
- Debug message processing

## Additional Resources

This skill includes comprehensive reference documentation based on AWS best practices:

- **Serverless Patterns**: `references/serverless-patterns.md`
  - Core serverless architectures and API patterns
  - Data processing and integration patterns
  - Orchestration with Step Functions
  - Anti-patterns to avoid

- **Event-Driven Architecture Patterns**: `references/eda-patterns.md`
  - Event routing and processing patterns
  - Event sourcing and saga patterns
  - Idempotency and error handling
  - Message ordering and deduplication

- **Security Best Practices**: `references/security-best-practices.md`
  - Shared responsibility model
  - IAM least privilege patterns
  - Data protection and encryption
  - Network security with VPC

- **Observability Best Practices**: `references/observability-best-practices.md`
  - Three pillars: metrics, logs, traces
  - Structured logging with Lambda Powertools
  - X-Ray distributed tracing
  - CloudWatch alarms and dashboards

- **Performance Optimization**: `references/performance-optimization.md`
  - Cold start optimization techniques
  - Memory and CPU optimization
  - Package size reduction
  - Provisioned concurrency patterns

- **Deployment Best Practices**: `references/deployment-best-practices.md`
  - CI/CD pipeline design
  - Testing strategies (unit, integration, load)
  - Deployment strategies (canary, blue/green)
  - Rollback and safety mechanisms

**External Resources**:

- **AWS Well-Architected Serverless Lens**: https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/
- **ServerlessLand.com**: Pre-built serverless patterns
- **AWS Serverless Workshops**: https://serverlessland.com/learn?type=Workshops

---

**Related Skills**:
- `aws-serverless-eda-foundational` - Design principles and foundational concepts
- `aws-serverless-eda-patterns` - Practical pattern implementations
