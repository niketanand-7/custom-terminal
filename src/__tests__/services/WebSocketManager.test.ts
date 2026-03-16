// src/__tests__/services/WebSocketManager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebSocketManager } from '../../services/WebSocketManager'

// --- Mock WebSocket ---
class MockWebSocket {
  static instances: MockWebSocket[] = []
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  sent: string[] = []
  url: string

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }
}

describe('WebSocketManager', () => {
  let manager: WebSocketManager

  beforeEach(() => {
    vi.useFakeTimers()
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
    manager = new WebSocketManager('wss://test.example.com/ws')
  })

  afterEach(() => {
    manager.destroy()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('connects on first subscribe', () => {
    const cb = vi.fn()
    manager.subscribe('btcusdt@ticker', cb)
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(MockWebSocket.instances[0].url).toBe('wss://test.example.com/ws')
  })

  it('sends SUBSCRIBE frame after connection opens', () => {
    const cb = vi.fn()
    manager.subscribe('btcusdt@ticker', cb)
    MockWebSocket.instances[0].simulateOpen()
    const sent = JSON.parse(MockWebSocket.instances[0].sent[0])
    expect(sent.method).toBe('SUBSCRIBE')
    expect(sent.params).toContain('btcusdt@ticker')
  })

  it('dispatches messages to the correct subscriber', () => {
    const cb = vi.fn()
    manager.subscribe('btcusdt@ticker', cb)
    MockWebSocket.instances[0].simulateOpen()

    const tickData = { e: '24hrTicker', s: 'BTCUSDT', c: '50000' }
    MockWebSocket.instances[0].simulateMessage(tickData)

    expect(cb).toHaveBeenCalledWith(tickData)
  })

  it('reference counts: second subscribe to same stream does not send another frame', () => {
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    manager.subscribe('btcusdt@ticker', cb1)
    MockWebSocket.instances[0].simulateOpen()

    manager.subscribe('btcusdt@ticker', cb2)

    // Only one SUBSCRIBE frame sent (from first subscribe)
    const subscribes = MockWebSocket.instances[0].sent
      .map((s) => JSON.parse(s))
      .filter((m) => m.method === 'SUBSCRIBE')
    expect(subscribes).toHaveLength(1)
  })

  it('reference counts: both callbacks receive messages', () => {
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    manager.subscribe('btcusdt@ticker', cb1)
    MockWebSocket.instances[0].simulateOpen()
    manager.subscribe('btcusdt@ticker', cb2)

    const tickData = { e: '24hrTicker', s: 'BTCUSDT', c: '50000' }
    MockWebSocket.instances[0].simulateMessage(tickData)

    expect(cb1).toHaveBeenCalledWith(tickData)
    expect(cb2).toHaveBeenCalledWith(tickData)
  })

  it('unsubscribe decrements refcount; only sends UNSUBSCRIBE when hitting zero', () => {
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    const unsub1 = manager.subscribe('btcusdt@ticker', cb1)
    MockWebSocket.instances[0].simulateOpen()
    const unsub2 = manager.subscribe('btcusdt@ticker', cb2)

    unsub1()
    // refcount is 1, should NOT send UNSUBSCRIBE
    const afterFirst = MockWebSocket.instances[0].sent
      .map((s) => JSON.parse(s))
      .filter((m) => m.method === 'UNSUBSCRIBE')
    expect(afterFirst).toHaveLength(0)

    unsub2()
    // refcount is 0, should send UNSUBSCRIBE
    const afterSecond = MockWebSocket.instances[0].sent
      .map((s) => JSON.parse(s))
      .filter((m) => m.method === 'UNSUBSCRIBE')
    expect(afterSecond).toHaveLength(1)
    expect(afterSecond[0].params).toContain('btcusdt@ticker')
  })

  it('unsubscribed callback stops receiving messages', () => {
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    const unsub1 = manager.subscribe('btcusdt@ticker', cb1)
    MockWebSocket.instances[0].simulateOpen()
    manager.subscribe('btcusdt@ticker', cb2)

    unsub1()

    const tickData = { e: '24hrTicker', s: 'BTCUSDT', c: '50000' }
    MockWebSocket.instances[0].simulateMessage(tickData)

    expect(cb1).not.toHaveBeenCalled()
    expect(cb2).toHaveBeenCalledWith(tickData)
  })

  it('calls onStatusChange callback', () => {
    const statusCb = vi.fn()
    manager = new WebSocketManager('wss://test.example.com/ws', { onStatusChange: statusCb })
    manager.subscribe('btcusdt@ticker', vi.fn())
    MockWebSocket.instances[0].simulateOpen()
    expect(statusCb).toHaveBeenCalledWith('connected')
  })

  it('reconnects with exponential backoff on close', () => {
    manager.subscribe('btcusdt@ticker', vi.fn())
    MockWebSocket.instances[0].simulateOpen()
    MockWebSocket.instances[0].simulateClose()

    // First reconnect after 1s
    expect(MockWebSocket.instances).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(MockWebSocket.instances).toHaveLength(2)
  })

  it('restores subscriptions after reconnect', () => {
    const cb = vi.fn()
    manager.subscribe('btcusdt@ticker', cb)
    MockWebSocket.instances[0].simulateOpen()
    MockWebSocket.instances[0].simulateClose()

    vi.advanceTimersByTime(1000)
    MockWebSocket.instances[1].simulateOpen()

    // Should re-send SUBSCRIBE for btcusdt@ticker
    const sent = MockWebSocket.instances[1].sent
      .map((s) => JSON.parse(s))
      .filter((m) => m.method === 'SUBSCRIBE')
    expect(sent).toHaveLength(1)
    expect(sent[0].params).toContain('btcusdt@ticker')
  })

  it('heartbeat timeout triggers reconnect after 60s silence', () => {
    manager.subscribe('btcusdt@ticker', vi.fn())
    MockWebSocket.instances[0].simulateOpen()

    // Advance 60s with no messages — heartbeat fires ws.close(), which schedules reconnect
    vi.advanceTimersByTime(60_000)
    // Reconnect timer fires after 1s (first backoff attempt)
    vi.advanceTimersByTime(1000)

    // Should have closed and started reconnect
    expect(MockWebSocket.instances.length).toBeGreaterThan(1)
  })

  it('heartbeat resets on each message', () => {
    manager.subscribe('btcusdt@ticker', vi.fn())
    MockWebSocket.instances[0].simulateOpen()

    // Send a message at 30s
    vi.advanceTimersByTime(30_000)
    MockWebSocket.instances[0].simulateMessage({ ping: true })

    // Advance another 50s (total 80s, but only 50s since last message)
    vi.advanceTimersByTime(50_000)

    // Should still be only 1 connection at this point (50s < 60s since last msg)
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('exponential backoff: second reconnect waits 2s', () => {
    manager.subscribe('btcusdt@ticker', vi.fn())
    MockWebSocket.instances[0].simulateOpen()
    MockWebSocket.instances[0].simulateClose()

    // First reconnect at 1s
    vi.advanceTimersByTime(1000)
    expect(MockWebSocket.instances).toHaveLength(2)
    MockWebSocket.instances[1].simulateClose()

    // Second reconnect should wait 2s, not 1s
    vi.advanceTimersByTime(1000)
    expect(MockWebSocket.instances).toHaveLength(2) // not yet
    vi.advanceTimersByTime(1000)
    expect(MockWebSocket.instances).toHaveLength(3) // now at 2s
  })

  it('backoff caps at 30s', () => {
    manager.subscribe('btcusdt@ticker', vi.fn())
    MockWebSocket.instances[0].simulateOpen()

    // Simulate many consecutive failures to exceed 30s cap
    for (let i = 0; i < 10; i++) {
      const lastIdx = MockWebSocket.instances.length - 1
      MockWebSocket.instances[lastIdx].simulateClose()
      vi.advanceTimersByTime(30_000) // max delay
    }

    // Should have reconnected each time (10 closes + original = 11 total)
    expect(MockWebSocket.instances.length).toBe(11)
  })

  it('double unsubscribe is safe', () => {
    const cb = vi.fn()
    const unsub = manager.subscribe('btcusdt@ticker', cb)
    MockWebSocket.instances[0].simulateOpen()

    unsub()
    unsub() // should not throw or send duplicate UNSUBSCRIBE

    const unsubFrames = MockWebSocket.instances[0].sent
      .map((s) => JSON.parse(s))
      .filter((m) => m.method === 'UNSUBSCRIBE')
    expect(unsubFrames).toHaveLength(1)
  })

  it('destroy closes connection and prevents reconnect', () => {
    manager.subscribe('btcusdt@ticker', vi.fn())
    MockWebSocket.instances[0].simulateOpen()
    manager.destroy()

    vi.advanceTimersByTime(60_000)
    // No new connections after destroy
    expect(MockWebSocket.instances).toHaveLength(1)
  })
})
