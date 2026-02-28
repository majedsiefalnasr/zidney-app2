/**
 * Type shim for 'bullmq' package
 *
 * Minimal type declarations for BullMQ queue/worker primitives
 * used in integration tests. BullMQ is not installed in the root
 * workspace; tests that use it rely on mocks.
 *
 * Stage: STAGE_INFRA_01_TYPESCRIPT_STABILIZATION (T083)
 * Note: Full BullMQ types available if bullmq is added to dependencies.
 */
declare module 'bullmq' {
  export interface JobData {
    [key: string]: unknown
  }

  export interface JobOptions {
    attempts?: number
    backoff?: {
      type: 'exponential' | 'fixed'
      delay: number
    }
    delay?: number
    removeOnComplete?: boolean | number
    removeOnFail?: boolean | number
    jobId?: string
  }

  export interface JobProgress {
    percentage?: number
    [key: string]: unknown
  }

  export class Job<T = JobData, R = unknown, N extends string = string> {
    id?: string
    name: N
    data: T
    opts: JobOptions
    attemptsMade: number
    timestamp: number
    finishedOn?: number
    processedOn?: number
    returnvalue?: R
    stacktrace?: string[]

    constructor(queue: Queue<T, R, N>, name: N, data: T, opts?: JobOptions)

    updateProgress(progress: number | JobProgress): Promise<void>
    remove(): Promise<void>
    retry(): Promise<void>
    getState(): Promise<string>
    waitUntilFinished(queueEvents: QueueEvents, ttl?: number): Promise<R>
    toJSON(): Record<string, unknown>

    static fromId<T, R, N extends string = string>(
      queue: Queue<T, R, N>,
      jobId: string
    ): Promise<Job<T, R, N> | undefined>
  }

  export type Processor<T = JobData, R = unknown, N extends string = string> = (
    job: Job<T, R, N>
  ) => Promise<R>

  export class Queue<T = JobData, R = unknown, N extends string = string> {
    constructor(name: string, opts?: { connection: unknown })

    add(name: N, data: T, opts?: JobOptions): Promise<Job<T, R, N>>
    addBulk(
      jobs: Array<{ name: N; data: T; opts?: JobOptions }>
    ): Promise<Array<Job<T, R, N>>>
    getJob(jobId: string): Promise<Job<T, R, N> | undefined>
    getJobs(
      types?: string[],
      start?: number,
      end?: number,
      asc?: boolean
    ): Promise<Array<Job<T, R, N>>>
    getJobCounts(): Promise<Record<string, number>>
    pause(): Promise<void>
    resume(): Promise<void>
    close(): Promise<void>
    obliterate(opts?: { force?: boolean }): Promise<void>
    process(concurrency: number, processor: Processor<T, R, N>): void
    on(event: string, listener: (...args: unknown[]) => void): this
    once(event: string, listener: (...args: unknown[]) => void): this
    off(event: string, listener: (...args: unknown[]) => void): this
    emit(event: string, ...args: unknown[]): boolean
  }

  export class Worker<T = JobData, R = unknown, N extends string = string> {
    constructor(
      name: string,
      processor: Processor<T, R, N>,
      opts?: {
        connection: unknown
        concurrency?: number
        autorun?: boolean
      }
    )

    run(): Promise<void>
    pause(doNotWaitActive?: boolean): Promise<void>
    resume(): void
    close(force?: boolean): Promise<void>
    start(): Promise<void>
    on(event: string, listener: (...args: unknown[]) => void): this
    once(event: string, listener: (...args: unknown[]) => void): this
    off(event: string, listener: (...args: unknown[]) => void): this
    emit(event: string, ...args: unknown[]): boolean
  }

  export class QueueEvents {
    constructor(name: string, opts?: { connection: unknown })
    close(): Promise<void>
    on(event: string, listener: (...args: unknown[]) => void): this
  }

  export class QueueScheduler {
    constructor(name: string, opts?: { connection: unknown })
    close(): Promise<void>
  }

  export interface FlowJob<T = JobData> {
    name: string
    data?: T
    options?: JobOptions
    queueName: string
    children?: Array<FlowJob>
  }

  export class FlowProducer {
    constructor(opts?: { connection: unknown })
    add(flow: FlowJob): Promise<{ job: Job; children?: Array<{ job: Job }> }>
    close(): Promise<void>
  }
}
