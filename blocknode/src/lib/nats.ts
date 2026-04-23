import { connect, NatsConnection, StringCodec } from 'nats'
import { log } from './logger'

let natsSingleton: NatsConnection | null = null
const sc = StringCodec()

const getNatsConnection = async (host: string, port: number): Promise<NatsConnection | null> => {
  if (natsSingleton && !natsSingleton.isClosed()) {
    log.info('Reusing existing NATS connection', { host, port })
    return natsSingleton
  }

  // check host is valid
  try {
    new URL(`nats://${host}`)
  } catch {
    log.error('Invalid NATS host', { host })
    return null
  }

  try {
    natsSingleton = await connect({ servers: `${host}:${port}` })
    log.info('Connected to NATS', { host, port })
    return natsSingleton
  } catch (error) {
    log.error('Failed to connect to NATS', { host, port, error })
    return null
  }
}

const pub = async (nats: NatsConnection, subject: string, message: string) => {
  try{
    nats.publish(subject, sc.encode(message))
    log.info('Published to NATS', { subject, message })
  } catch (error) {
    log.error('Failed to publish to NATS', { subject, message, error })
  }
}

const close = async () => {
  if (natsSingleton && !natsSingleton.isClosed()) {
    await natsSingleton.drain()
    natsSingleton = null
  }
}

export { pub, getNatsConnection, close }
