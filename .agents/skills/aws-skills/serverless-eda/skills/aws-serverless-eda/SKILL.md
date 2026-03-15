---
name: aws-serverless-eda
description: **PARENT SKILL** - AWS serverless and event-driven architecture expert. This is a reference skill that delegates to three specialized domain skills. Use when building serverless APIs, Lambda functions, microservices, or async workflows. Automatically loads: aws-serverless-eda-foundational, aws-serverless-eda-patterns, aws-serverless-eda-operations.
context: fork
skills:
  - aws-mcp-setup
  - aws-cdk-development
  - aws-serverless-eda-foundational
  - aws-serverless-eda-patterns
  - aws-serverless-eda-operations
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
  - Bash(aws sts get-caller-identity)
hooks:
  PreToolUse:
    - matcher: Bash(sam deploy*)
      command: aws sts get-caller-identity --query Account --output text
      once: true
---

# AWS Serverless & Event-Driven Architecture

**PARENT SKILL** - This skill has been refactored into three specialized domain skills for better maintainability (Phase 5 optimization, Q4 requirement: keep SKILL.md files <500 lines).

## Skill Domain Organization

This expert skill is now organized into three focused domains:

### 1. **aws-serverless-eda-foundational** (Principles & Concepts)
- Core AWS Well-Architected serverless design principles
- MCP tool configuration and setup
- Foundational patterns and prerequisites

**Use when**: Learning serverless architecture principles, understanding design philosophy, setting up development environment

### 2. **aws-serverless-eda-patterns** (Practical Implementations)
- Event-driven architecture patterns (EventBridge, SQS, SNS, Event Sourcing, Saga)
- Serverless microservices patterns (APIs, streams, async jobs, scheduled jobs, webhooks)
- Code examples for 10+ production patterns

**Use when**: Implementing specific patterns, building event-driven systems, designing microservices, processing data

### 3. **aws-serverless-eda-operations** (Production Readiness)
- Error handling and dead letter queues
- Observability, tracing, and monitoring
- Best practices for operational excellence
- MCP server usage and integration

**Use when**: Implementing error handling, setting up observability, making systems production-ready, operational concerns

## When to Use This Skill

Use this parent skill when:

- **Getting started with serverless**: Need foundational knowledge + patterns
- **Full expertise scope**: Building complete serverless applications
- **Implementing comprehensive solutions**: Combining principles, patterns, and operations

Or use specific domain skills for focused tasks:
- **aws-serverless-eda-foundational**: Design phase
- **aws-serverless-eda-patterns**: Implementation phase
- **aws-serverless-eda-operations**: Production hardening phase

## AWS Documentation

This skill ecosystem requires AWS MCP tools for accurate, up-to-date AWS information. See the domain skills for MCP configuration and usage guidance.

## Total Skill Coverage

- **Principles**: AWS Well-Architected Framework, 7 core design principles
- **Patterns**: 11 architecture patterns across event-driven, serverless, and operations categories
- **Operations**: Error handling, DLQ management, observability, X-Ray tracing, CloudWatch monitoring
- **Code Examples**: 20+ TypeScript/CDK code samples
- **MCP Integration**: Serverless, Lambda, Step Functions, SNS/SQS MCP servers
- **Best Practices**: Security, performance, deployment, testing, rollback strategies

## Architecture Self-Healing Context (Phase 5)

This skill was refactored from 805 lines to three specialized skills (270 + 371 + 208 = 849 lines total, with slightly increased content due to inter-skill references) as part of repository optimization Phase 5:

- ✅ Decomposed by domain: Principles → Patterns → Operations
- ✅ Each skill <500 lines (Q4 requirement)
- ✅ Clear skill dependencies and relationships documented
- ✅ Maintained all original content with added references
- ✅ Discoverable via SKILLS_INDEX.md (created in T099)

---

**Domain Skills** (automatically loaded as dependencies):
- `aws-serverless-eda-foundational` - Design principles
- `aws-serverless-eda-patterns` - Practical patterns
- `aws-serverless-eda-operations` - Operational excellence

**Related Parent Skills**:
- `aws-mcp-setup` - Required for MCP configuration
- `aws-cdk-development` - Required for CDK examples
