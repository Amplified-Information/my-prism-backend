type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const colors = {
	reset: '\x1b[0m',
	dim: '\x1b[2m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	red: '\x1b[31m',
	cyan: '\x1b[36m',
	white: '\x1b[37m'
}

const levelColor: Record<LogLevel, string> = {
	info: colors.green,
	warn: colors.yellow,
	error: colors.red,
	debug: colors.cyan
}

const useColor = process.env.USE_COLOR === '1'

const write = (level: LogLevel, message: string, data?: Record<string, unknown>) => {
	// Only show info, warn, error unless DEBUG=1
	if (level === 'debug' && process.env.DEBUG !== '1') return
	
	if (useColor) {
		const ts = `${colors.dim}${new Date().toISOString()}${colors.reset}`
		const lvl = `${levelColor[level]}${level.toUpperCase().padEnd(5)}${colors.reset}`
		const msg = `${colors.white}${message}${colors.reset}`
		const extra = data && Object.keys(data).length > 0
			? ` ${colors.cyan}${JSON.stringify(data)}${colors.reset}`
			: ''
		const line = `${ts} ${lvl} ${msg}${extra}\n`
		if (level === 'error') {
			process.stderr.write(line)
		} else {
			process.stdout.write(line)
		}
	} else {
		const entry = JSON.stringify({
			timestamp: new Date().toISOString(),
			level,
			service: 'blocknode',
			message,
			...data
		})
		if (level === 'error') {
			process.stderr.write(entry + '\n')
		} else {
			process.stdout.write(entry + '\n')
		}
	}
}

export const log = {
	info: (message: string, data?: Record<string, unknown>) => write('info', message, data),
	warn: (message: string, data?: Record<string, unknown>) => write('warn', message, data),
	error: (message: string, data?: Record<string, unknown>) => write('error', message, data),
	debug: (message: string, data?: Record<string, unknown>) => write('debug', message, data)
}
