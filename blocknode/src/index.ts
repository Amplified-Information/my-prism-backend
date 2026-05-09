
import { ContractId, LedgerId } from '@hiero-ledger/sdk'
import { pubAllEventsForContract } from './lib/hedera'
import { log } from './lib/logger'
import { getNatsConnection } from './lib/nats'
import { sleep } from './lib/util'
import Dedupe from './lib/dedupe'

// DEBUG=1 to enable debug messages
// USE_COLOR=1 to enable colors in logs



// --- Guard required env vars ---
// keep in sync with: .config, docker-compose-data.yml, src/index.ts, Dockerfile, localRun.sh
const requiredVars = ['BN_NATS_HOST', 'BN_NATS_PORT', 'BN_QUERY_FREQ_SECS', 'BN_QUERY_LOOKBACK_SECS', 'BN_SUPPORTED_NETWORKS']

// Add SMART_CONTRACT_IDS_{NET} for each network in SUPPORTED_NETWORKS
const supportedNetworks = (process.env.BN_SUPPORTED_NETWORKS || '').split(/[, ]+/).filter(Boolean)
for (const n of supportedNetworks) {
	try {
		LedgerId.fromString(n)
	} catch {
		log.error('Invalid network (LedgerId)', { network: n })
		process.exit(1)
	}
	requiredVars.push(`BN_SMART_CONTRACT_IDS_${n.toUpperCase()}`)
}

const missingVars = requiredVars.filter((v) => !(v in process.env))
if (missingVars.length > 0) {
	log.error('Missing required environment variables', { missing: missingVars })
	process.exit(1)
}

// Validate contract IDs for all supported networks
const contractIdsByNetwork: Record<string, string[]> = {}

for (const n of supportedNetworks) {
	const key = `BN_SMART_CONTRACT_IDS_${n.toUpperCase()}`
	const list = process.env[key] || ''
	const ids = list.split(' ').filter(Boolean)

	for (const id of ids) {
		try {
			ContractId.fromString(id)
		} catch {
			log.error('Invalid smart contract ID', { envVar: key, id })
			process.exit(1)
		}
	}

	contractIdsByNetwork[n] = ids
}

// For every smart contract ID, there must be a corresponding ABI in the env vars with key `ABI_{NET}_{CONTRACT_ID}` where {CONTRACT_ID} is the contract ID with dots replaced by underscores
for (const n of supportedNetworks) {
	for (const contractId of contractIdsByNetwork[n] ?? []) {
		// validate a key exists for the ABI of this contract
		const abiKey = `ABI_${n.toUpperCase()}_${contractId.replace(/\./g, '_')}`
		if (!(abiKey in process.env)) {
			log.error('Missing ABI for smart contract', { envVar: abiKey, network: n, contractId })
			process.exit(1)
		}

		// the value MUST be set
		// the value must be valid JSON
		const abiValue = process.env[abiKey]
		// console.log(abiValue)
		if (!abiValue) {
			log.error('Missing ABI for smart contract', { envVar: abiKey, network: n, contractId })
			process.exit(1)
		}
		try {
			JSON.parse(abiValue)
		} catch {
			log.error('Invalid ABI JSON for smart contract', { envVar: abiKey, network: n, contractId })
			process.exit(1)
		}
	}
}

let QUERY_FREQ_SECS = 0
let QUERY_LOOKBACK_SECS = 0
try {
	QUERY_FREQ_SECS = parseInt(process.env.BN_QUERY_FREQ_SECS!, 10)
	QUERY_LOOKBACK_SECS = parseInt(process.env.BN_QUERY_LOOKBACK_SECS!, 10)

	if (isNaN(QUERY_FREQ_SECS) || isNaN(QUERY_LOOKBACK_SECS)) {
		throw new Error('BN_QUERY_FREQ_SECS and BN_QUERY_LOOKBACK_SECS must be valid numbers')
	}
} catch (e) {
	log.error('Invalid number in BN_QUERY_FREQ_SECS or BN_QUERY_LOOKBACK_SECS', { error: e })
	process.exit(1)
}


// a deduplicating stack to avoid republishing the same event multiple times if it appears in multiple polling intervals - stores txHashes with a timestamp of when they were published, and evicts entries when the max size is exceeded
let DEDUPE_STACK_SIZE = 0
try {
	DEDUPE_STACK_SIZE = parseInt(process.env.BN_DEDUPE_STACK_SIZE!, 10) || 1000
	if (isNaN(DEDUPE_STACK_SIZE)) {
		throw new Error('BN_DEDUPE_STACK_SIZE must be a valid number')
	}
} catch (e) {
	log.error('Invalid number in BN_DEDUPE_STACK_SIZE', { error: e })
	process.exit(1)
}




/////
// OK - proceed
/////
log.info('Starting monitor', { networks: supportedNetworks, contractIdsByNetwork, pollIntervalSecs: QUERY_FREQ_SECS, lookbackSecs: QUERY_LOOKBACK_SECS })

const stack = new Dedupe(DEDUPE_STACK_SIZE)

const main = async () => {
	// get a nats singleton
	const nats = await getNatsConnection(process.env.BN_NATS_HOST!, parseInt(process.env.BN_NATS_PORT!, 10))
	if (!nats) {
		log.error('Failed to connect to NATS, exiting')
		process.exit(1)
	}

	// ask the user if they'd like to look back X minutes on startup to catch recent events, or start fresh from now
	// stdin - gather the number of minutes
	// user has 5 seconds to respond, otherwise the program continues as normal
	log.info('Do you want to look back for recent events on startup?')
	log.info('[optional] You have 5 seconds to enter the number of minutes you want to look back.')
	log.info('You can optionally send a second integer - the number of minutes past the look back time - e.g. "10 1" processes events between 10 mins ago and 9 mins ago.')
	const stdin = process.stdin
	stdin.setEncoding('utf-8')

	let { lookbackMins, toMins } = await new Promise<{ lookbackMins: number, toMins: number }>((resolve) => {
		let responded = false

		// 5 seconds to respond
		const timeout = setTimeout(() => {
			if (!responded) {
				log.info('No response received, starting without lookback')
				resolve({ lookbackMins: 0, toMins: 0 })
			}
		}, 5000)

		stdin.on('data', (data) => {
			responded = true
			
			try {
				// the input forma can be:
				// VALID: \d+
				// VALID: \d+\s\d+
				// INVALID: anything else
				const s = data.toString().trim().split(/\s+/)
				const s0 = s[0]! || '0' // default to "0" if the first integer is not provided (e.g. user just presses enter) - gracefully continue with 0 lookback
				const s1 = s[1] || s0 // default is to look forard the same amount of time as the lookback period if the second integer is not provided - e.g. "10" is treated as "10 10"
				const validLookbackMins = parseInt(s0, 10)
				const validToMins = parseInt(s1, 10)

				if (isNaN(validLookbackMins) || isNaN(validToMins)) {
					log.error(`Invalid input, not a number: lookbackPart=${s0}, toPart=${s1}`)
					resolve({ lookbackMins: 0, toMins: 0 })
					// return
					process.exit(1)
				} else {
					// OK - valid input
					resolve({ lookbackMins: validLookbackMins, toMins: validToMins })
				}
			} catch (e) {
				log.error(`invalid number lookbackMins: ${e}`)
				resolve({ lookbackMins: 0, toMins: 0 }) // set lookbackMins to 0 - gracefully continue 
			} finally {
				clearTimeout(timeout)
			}
		})
	})

	if (lookbackMins === 0) {
		lookbackMins = QUERY_LOOKBACK_SECS * 60 // default
		toMins = lookbackMins
		log.info(`No input received. Defaulting to configured lookback time of ${lookbackMins} mins (with the same lookahead time of ${toMins} mins)`)
	}

	log.info(`lookbackMins: ${lookbackMins} (+ ${toMins} mins lookahead)`)









	
	const pubAllEventsForSmartContractsOnNetworks = (lookbackMins: number, toMins: number) => {
		for (const n of supportedNetworks) {
			for (const contractId of (contractIdsByNetwork[n] ?? [])) {
				// log.info('Monitoring contract', { network: n, contractId })
				pubAllEventsForContract(stack, nats, LedgerId.fromString(n), ContractId.fromString(contractId), Math.floor(new Date().getTime()/1000 - (lookbackMins * 60)), (Math.floor(new Date().getTime()/1000 - (lookbackMins * 60)) + (toMins * 60) + 1) )
			}
		}
	}









	// if user has requested a longer than normal lookback period (e.g. after downtime)

	if (lookbackMins > 0) {
		pubAllEventsForSmartContractsOnNetworks(lookbackMins, toMins)
		// once done the initial pass, set the params back to defaults:
		lookbackMins = QUERY_LOOKBACK_SECS
		toMins = QUERY_LOOKBACK_SECS
		if (isNaN(lookbackMins) || isNaN(toMins)) {
			log.error('lookbackMins or toMins is NaN after lookback pass. Exiting.', { lookbackMins, toMins })
			process.exit(1)
		}
		log.info(`Finished initial lookback pass. Now proceeding with normal operation with lookbackMins=${lookbackMins} and toMins=${toMins}`)
	}

	// canonical: proceed with the infinite loop as normal:
	while (true) {
		pubAllEventsForSmartContractsOnNetworks(lookbackMins, toMins)
		await sleep(QUERY_FREQ_SECS * 1000)
	}
}

main()