import { Context } from '@deepseek-ai/cordis'
import type { PeerId } from '@deepseek-ai/dsh-typert-protocol'
import { describe, expect, it, vi } from 'vitest'
import type { BrowserAuth } from '../src/browser-auth.ts'
import type { ConnectionIndexRequest, ConnectionIndexResponse, ConnectionTrustRequest } from '../src/rpc.ts'
import { HostConnectionService } from '../src/rpc-host.ts'
import type { RemoteConnectionRequest } from '../src/remote-connection-request.ts'

/** Headers-only trust request; the fence reads the Host header. */
function request(host: string): ConnectionTrustRequest {
  return { headers: { host } }
}

async function mounted(trustedHosts: readonly string[]): Promise<{
  readonly connection: HostConnectionService
  readonly requests: RemoteConnectionRequest[]
  /** Publish one API Peer the way a completed /connect handshake does. */
  readonly publishPeer: () => PeerId
  readonly dispose: () => Promise<void>
}> {
  const ctx = new Context()
  const requests: RemoteConnectionRequest[] = []
  ctx.on('connection/remote-requested', (announced) => { requests.push(announced) })
  let published: PeerId | undefined
  const browserAuth = {
    isAuthenticated: () => false,
    authenticateApi: () => published,
    authorizeConnect: (
      _request: ConnectionIndexRequest, _response: ConnectionIndexResponse, _secure: boolean,
      publish: (interactions: 'answer' | 'none') => PeerId,
    ) => {
      published = publish('answer')
    },
  } as unknown as BrowserAuth
  const fiber = ctx.plugin((pluginCtx) => {
    new HostConnectionService(pluginCtx, trustedHosts, browserAuth)
  })
  await fiber.await()
  const connection = ctx.get('connection') as HostConnectionService
  return {
    connection,
    requests,
    publishPeer: () => {
      const response = { writeHead: vi.fn(), end: vi.fn() }
      connection.authorizeConnect(request('127.0.0.1:1'), response)
      if (published === undefined) throw new Error('peer publication did not run')
      return published
    },
    dispose: () => fiber.dispose(),
  }
}

describe('Connection remote-requested announcement', () => {
  it('stays silent for a loopback authority that carries an explicit port', async () => {
    const { connection, requests, publishPeer, dispose } = await mounted([])
    const peer = publishPeer()
    const admission = connection.admitConnection(request('127.0.0.1:3741'))
    expect(admission).toMatchObject({ peer: { id: peer } })
    expect(requests).toEqual([])
    await dispose()
  })

  it('stays silent for a bracketed IPv6 loopback authority with a port', async () => {
    const { connection, requests, publishPeer, dispose } = await mounted([])
    publishPeer()
    connection.admitConnection(request('[::1]:8080'))
    expect(requests).toEqual([])
    await dispose()
  })

  it('announces one admitted non-loopback authority with its peer facts', async () => {
    const { connection, requests, publishPeer, dispose } = await mounted(['peer.example.com'])
    const peer = publishPeer()
    const admission = connection.admitConnection(request('peer.example.com:8443'))
    expect(admission).toMatchObject({ peer: { id: peer } })
    expect(requests).toEqual([{
      authority: 'peer.example.com:8443',
      peerId: peer,
      interactions: 'answer',
    }])
    await dispose()
  })
})
