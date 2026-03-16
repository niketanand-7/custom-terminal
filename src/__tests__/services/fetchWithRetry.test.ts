// src/__tests__/services/fetchWithRetry.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithRetry } from '../../services/fetchWithRetry'

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns response on first success', async () => {
    const mockResponse = { ok: true, json: () => Promise.resolve({ data: 1 }) }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as Response)

    const result = await fetchWithRetry('https://api.example.com/test')
    expect(result).toBe(mockResponse)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('retries on failure and succeeds on second attempt', async () => {
    const mockResponse = { ok: true, json: () => Promise.resolve({ data: 1 }) }
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(mockResponse as Response)

    const promise = fetchWithRetry('https://api.example.com/test')
    await vi.advanceTimersByTimeAsync(1000)
    const result = await promise
    expect(result).toBe(mockResponse)
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('retries on non-ok status and succeeds on third attempt', async () => {
    const failResponse = { ok: false, status: 500, statusText: 'Internal Server Error' } as Response
    const successResponse = { ok: true, json: () => Promise.resolve({}) } as Response
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(failResponse)
      .mockResolvedValueOnce(failResponse)
      .mockResolvedValueOnce(successResponse)

    const promise = fetchWithRetry('https://api.example.com/test')
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(3000)
    const result = await promise
    expect(result).toBe(successResponse)
    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
  })

  it('throws after all retries exhausted (network errors)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))

    const promise = fetchWithRetry('https://api.example.com/test')
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(3000)
    await expect(promise).rejects.toThrow('network error')
    // 1 initial + 2 retries = 3 total
    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
  })

  it('throws after all retries return non-ok responses', async () => {
    const failResponse = { ok: false, status: 500, statusText: 'Internal Server Error' } as Response
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(failResponse)

    const promise = fetchWithRetry('https://api.example.com/test')
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(3000)
    await expect(promise).rejects.toThrow('HTTP 500')
    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
  })
})
