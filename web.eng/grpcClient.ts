import { GrpcWebFetchTransport } from '@protobuf-ts/grpcweb-transport'
import { ClobPublicClient } from './gen/clob.client.ts'
import { ApiAuthClient, ApiServicePublicClient } from './gen/api.client'
import { RpcOptions } from '@protobuf-ts/runtime-rpc'

const transport = new GrpcWebFetchTransport({
  // baseUrl: 'http://127.0.0.1:8080',
  // baseUrl: 'https://dev.prism.market:443', // https => grpc-web
  baseUrl: '/' // access via the proxy on port 8090
  
  // credentials: 'include',
  // interceptor: {
  //   intercept(request, invoker) {
  //     console.log('Interceptor called')
  //     const headers = request.init?.headers instanceof Headers
  //       ? request.init.headers
  //       : new Headers(request.init?.headers || {})
  //     const jwt = localStorage.getItem('jwt')
  //     if (jwt) {
  //       headers.set('Authorization', `Bearer ${jwt}`)
  //     }
  //     console.log('Interceptor called', Array.from(headers.entries()))
  //     request.init = {
  //       ...request.init,
  //       headers
  //     }
  //     return invoker(request)
  //   }
  // }

  // fetchInit: { credentials: 'include' }
  // withCredentials: true, // improbable - https://github.com/improbable-eng/grpc-web/blob/master/client/grpc-web/docs/transport.md
  

  // maxReceiveMessageLength: 10485760, // 10MB
  
  // fetch: (input: RequestInfo, init: RequestInit = {}) => {
  //   init.headers = {
  //     ...(init.headers || {})
  //     // 'Authorization': basicAuth,
  //     // 'Content-Type': 'application/grpc-web'
  //   }
  //   return fetch(input, init)
  // }
  
  // Allow messages larger than the default max (e.g., 100MB)
  // sendMaxBytes: 100 * 1024 * 1024,
  // receiveMaxBytes: 100 * 1024 * 1024
})


const authHeaders = (): RpcOptions => {
  const jwt = localStorage.getItem('jwt')
  const meta: Record<string, string> = {}
  if (jwt) {
    meta['Authorization'] = `${jwt}`
  }
  return { meta }
}

const clobClient = new ClobPublicClient(transport)
const apiClient = new ApiServicePublicClient(transport)
const authClient = new ApiAuthClient(transport)

export {
  clobClient,
  apiClient,
  authClient,

  authHeaders
}
