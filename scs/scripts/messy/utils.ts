// Helper function to convert hex string to Uint8Array
function arrayify(data: string): Uint8Array {
  if (typeof data !== 'string' || !data.startsWith('0x')) {
    throw new Error('Invalid hex string')
  }
  const hex = data.slice(2)
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

export {
  arrayify
}
