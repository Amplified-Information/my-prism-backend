import { createHash } from 'crypto'

const sleep = (ms: number) => {
	return new Promise((res) => setTimeout(res, ms))
}

function md5(text: string): string {
  return createHash('md5').update(text).digest('hex')
}

export { sleep, md5 }
