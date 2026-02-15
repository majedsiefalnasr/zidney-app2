import { createClient } from 'redis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

async function main() {
  const client = createClient({ url: redisUrl })

  client.on('error', (err) => {
    console.error('Redis Client Error', {
      error: err.message,
      correlationId: 'worker-startup',
    })
  })

  await client.connect()

  console.log('Worker connected to Redis', {
    level: 'info',
    service: 'worker',
    correlationId: 'worker-startup',
  })

  // Process a test job
  await client.set('test:key', 'worker-baseline')
  const value = await client.get('test:key')
  console.log('Worker test job completed', {
    level: 'info',
    service: 'worker',
    correlationId: 'worker-startup',
    value,
  })

  await client.disconnect()
}

main().catch((err) => {
  console.error('Worker startup failed', {
    level: 'error',
    service: 'worker',
    correlationId: 'worker-startup',
    error: err.message,
  })
  process.exit(1)
})
