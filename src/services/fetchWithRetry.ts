// src/services/fetchWithRetry.ts

const RETRY_DELAYS = [1000, 3000] // retry after 1s, then 3s, then fail

export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  let lastError: unknown

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await fetch(url, options)
      if (!response.ok) {
        if (attempt < RETRY_DELAYS.length) {
          await sleep(RETRY_DELAYS[attempt])
          continue
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      return response
    } catch (err) {
      lastError = err
      if (attempt < RETRY_DELAYS.length) {
        await sleep(RETRY_DELAYS[attempt])
        continue
      }
    }
  }

  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
