
import { Buffer } from 'buffer'
if (typeof window !== 'undefined') {
  window.Buffer = Buffer // hiero-ledger/sdk warning about (node.js) Buffer missing in web window
}
