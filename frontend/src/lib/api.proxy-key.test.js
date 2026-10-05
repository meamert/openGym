// @vitest-environment happy-dom

/* Own build with VITE_PROXY_KEY: every request to the paired server carries X-OpenGym-Key, so the
   reverse proxy can let it past its auth. A build without the key sends what upstream sends. */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./mobile.js', () => ({ MOBILE: true }))

const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

async function load(key) {
  vi.resetModules()
  if (key) vi.stubEnv('VITE_PROXY_KEY', key)
  return import('./api.js')
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('with VITE_PROXY_KEY', () => {
  it('api() sends it to the paired server next to the Bearer token', async () => {
    const { api, setRemoteAuth } = await load('K')
    const fetch = vi.fn(async () => json({ rev: 1 }))
    vi.stubGlobal('fetch', fetch)
    setRemoteAuth('https://gym.example.com', 'TOKEN')
    await api('/api/data/rev')
    expect(fetch.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer TOKEN', 'X-OpenGym-Key': 'K' })
  })

  it('pairRedeem() sends it before any pairing exists', async () => {
    const { pairRedeem } = await load('K')
    const fetch = vi.fn(async () => json({ token: 'T', user: { id: 'u' } }))
    vi.stubGlobal('fetch', fetch)
    await pairRedeem('https://gym.example.com', 'CODE')
    expect(fetch.mock.calls[0][0]).toBe('https://gym.example.com/api/pair/redeem')
    expect(fetch.mock.calls[0][1].headers['X-OpenGym-Key']).toBe('K')
  })

  it('apiBlob() sends it with the media download', async () => {
    const { apiBlob, setRemoteAuth } = await load('K')
    const fetchImpl = vi.fn(async () => new Response(new Blob(['x']), { status: 200 }))
    setRemoteAuth('https://gym.example.com', 'TOKEN')
    await apiBlob('/api/media/' + 'a'.repeat(64), { fetchImpl })
    expect(fetchImpl.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer TOKEN', 'X-OpenGym-Key': 'K' })
  })
})

describe('without VITE_PROXY_KEY', () => {
  it('no extra header goes out', async () => {
    const { api, pairRedeem, setRemoteAuth } = await load('')
    const fetch = vi.fn(async () => json({ token: 'T', user: { id: 'u' }, rev: 1 }))
    vi.stubGlobal('fetch', fetch)
    await pairRedeem('https://gym.example.com', 'CODE')
    setRemoteAuth('https://gym.example.com', 'TOKEN')
    await api('/api/data/rev')
    for (const [, init] of fetch.mock.calls) expect(init.headers).not.toHaveProperty('X-OpenGym-Key')
  })
})

describe('update check with VITE_PROXY_KEY', () => {
  it('never asks GitLab and never offers the official APK', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_PROXY_KEY', 'K')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { checkForUpdate } = await import('./update.js')
    await expect(checkForUpdate()).resolves.toMatchObject({ hasUpdate: false, apkUrl: null })
    expect(fetch).not.toHaveBeenCalled()
  })
})
