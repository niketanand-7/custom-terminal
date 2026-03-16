// src/services/WebSocketManager.ts
import type { ConnectionStatus, Unsubscribe } from '../types'

type StatusCallback = (status: ConnectionStatus) => void
type MessageCallback = (data: unknown) => void

type WebSocketManagerOptions = {
  onStatusChange?: StatusCallback
}

const HEARTBEAT_TIMEOUT = 60_000
const MAX_RECONNECT_DELAY = 30_000

export class WebSocketManager {
  private url: string
  private ws: WebSocket | null = null
  private destroyed = false
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null
  private onStatusChange: StatusCallback | undefined

  // stream → Set of callbacks
  private subscribers = new Map<string, Set<MessageCallback>>()

  // stream → refcount (separate from subscribers for tracking unsubscribe frame timing)
  private refCounts = new Map<string, number>()

  constructor(url: string, options?: WebSocketManagerOptions) {
    this.url = url
    this.onStatusChange = options?.onStatusChange
  }

  subscribe(stream: string, callback: MessageCallback): Unsubscribe {
    const currentRef = this.refCounts.get(stream) ?? 0

    // Add callback to subscriber set
    if (!this.subscribers.has(stream)) {
      this.subscribers.set(stream, new Set())
    }
    this.subscribers.get(stream)!.add(callback)
    this.refCounts.set(stream, currentRef + 1)

    // First subscriber for this stream → send SUBSCRIBE
    if (currentRef === 0) {
      this.ensureConnected()
      this.sendSubscribe([stream])
    } else if (!this.ws) {
      this.ensureConnected()
    }

    let unsubscribed = false
    return () => {
      if (unsubscribed) return
      unsubscribed = true

      this.subscribers.get(stream)?.delete(callback)
      const newRef = (this.refCounts.get(stream) ?? 1) - 1
      if (newRef <= 0) {
        this.refCounts.delete(stream)
        this.subscribers.delete(stream)
        this.sendUnsubscribe([stream])
      } else {
        this.refCounts.set(stream, newRef)
      }
    }
  }

  destroy(): void {
    this.destroyed = true
    this.clearTimers()
    this.ws?.close()
    this.ws = null
    this.subscribers.clear()
    this.refCounts.clear()
  }

  private ensureConnected(): void {
    if (this.ws || this.destroyed) return
    this.connect()
  }

  private connect(): void {
    if (this.destroyed) return

    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => {
      this.reconnectAttempt = 0
      this.onStatusChange?.('connected')
      this.resetHeartbeat()

      // Restore all active subscriptions
      const streams = Array.from(this.refCounts.keys())
      if (streams.length > 0) {
        this.sendSubscribe(streams)
      }
    }

    this.ws.onmessage = (event: MessageEvent) => {
      this.resetHeartbeat()
      try {
        const data = JSON.parse(event.data as string)
        // Broadcast to all subscribers — each BinanceProvider callback filters by
        // symbol (s field) and event type (e field). This keeps WebSocketManager
        // provider-agnostic rather than parsing Binance-specific stream names.
        for (const [, callbacks] of this.subscribers) {
          for (const cb of callbacks) {
            cb(data)
          }
        }
      } catch {
        // Ignore non-JSON messages (pong frames, etc.)
      }
    }

    this.ws.onclose = () => {
      this.ws = null
      this.clearHeartbeat()
      if (!this.destroyed) {
        this.onStatusChange?.('reconnecting')
        this.scheduleReconnect()
      } else {
        this.onStatusChange?.('disconnected')
      }
    }

    this.ws.onerror = () => {
      // onclose will fire after onerror, so reconnect is handled there
    }
  }

  private sendSubscribe(streams: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(
      JSON.stringify({
        method: 'SUBSCRIBE',
        params: streams,
        id: Date.now(),
      }),
    )
  }

  private sendUnsubscribe(streams: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(
      JSON.stringify({
        method: 'UNSUBSCRIBE',
        params: streams,
        id: Date.now(),
      }),
    )
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), MAX_RECONNECT_DELAY)
    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  private resetHeartbeat(): void {
    this.clearHeartbeat()
    this.heartbeatTimer = setTimeout(() => {
      // No message for 60s — assume dead connection
      this.ws?.close()
    }, HEARTBEAT_TIMEOUT)
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private clearTimers(): void {
    this.clearHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}
