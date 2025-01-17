const exec = require('child_process')
const fs = require('fs')
const crypto = require('crypto')
const bech32 = require('bech32')
const amqp = require('amqplib')

const { RABBITMQ_URL, PROXY_URL } = process.env

let currentKeygenEpoch = null

async function main () {
  console.log('Connecting to RabbitMQ server')
  const connection = await connectRabbit(RABBITMQ_URL)
  console.log('Connecting to epoch events queue')
  const channel = await connection.createChannel()
  const keygenQueue = await channel.assertQueue('keygenQueue')
  const cancelKeygenQueue = await channel.assertQueue('cancelKeygenQueue')

  channel.prefetch(1)
  channel.consume(keygenQueue.queue, msg => {
    const { epoch, parties, threshold } = JSON.parse(msg.content)
    console.log(`Consumed new epoch event, starting keygen for epoch ${epoch}`)

    const keysFile = `/keys/keys${epoch}.store`

    console.log('Running ./keygen-entrypoint.sh')
    currentKeygenEpoch = epoch

    console.log('Writing params')
    fs.writeFileSync('./params', JSON.stringify({ parties: parties.toString(), threshold: threshold.toString() }))
    const cmd = exec.execFile('./keygen-entrypoint.sh', [PROXY_URL, keysFile], async () => {
      currentKeygenEpoch = null
      if (fs.existsSync(keysFile)) {
        console.log(`Finished keygen for epoch ${epoch}`)
        const publicKey = JSON.parse(fs.readFileSync(keysFile))[5]
        console.log(`Generated multisig account in binance chain: ${publicKeyToAddress(publicKey)}`)

        console.log('Sending keys confirmation')
        await confirmKeygen(keysFile)
      } else {
        console.log(`Keygen for epoch ${epoch} failed`)
      }
      console.log('Ack for keygen message')
      channel.ack(msg)
    })
    cmd.stdout.on('data', data => console.log(data.toString()))
    cmd.stderr.on('data', data => console.error(data.toString()))
  })

  channel.consume(cancelKeygenQueue.queue, async msg => {
    const { epoch } = JSON.parse(msg.content)
    console.log(`Consumed new cancel event for epoch ${epoch} keygen`)
    if (currentKeygenEpoch === epoch) {
      console.log('Cancelling current keygen')
      exec.execSync('pkill gg18_keygen || true')
    }
    channel.ack(msg)
  })
}

main()

async function connectRabbit (url) {
  return amqp.connect(url).catch(() => {
    console.log('Failed to connect, reconnecting')
    return new Promise(resolve =>
      setTimeout(() => resolve(connectRabbit(url)), 1000)
    )
  })
}

async function confirmKeygen (keysFile) {
  exec.execSync(`curl -X POST -H "Content-Type: application/json" -d @"${keysFile}" "${PROXY_URL}/confirmKeygen"`, { stdio: 'pipe' })
}

function publicKeyToAddress ({ x, y }) {
  const compact = (parseInt(y[y.length - 1], 16) % 2 ? '03' : '02') + padZeros(x, 64)
  const sha256Hash = crypto.createHash('sha256').update(Buffer.from(compact, 'hex')).digest('hex')
  const hash = crypto.createHash('ripemd160').update(Buffer.from(sha256Hash, 'hex')).digest('hex')
  const words = bech32.toWords(Buffer.from(hash, 'hex'))
  return bech32.encode('tbnb', words)
}

function padZeros (s, len) {
  while (s.length < len)
    s = '0' + s
  return s
}
