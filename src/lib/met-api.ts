import type { MetObject, SeedObject } from "../types"

const BASE_URL = "https://collectionapi.metmuseum.org/public/collection/v1"

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchMetObjectWithRetry(objectID: number, retries = 2): Promise<MetObject> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(`${BASE_URL}/objects/${objectID}`)

    if (response.status === 429) {
      if (attempt < retries) {
        await delay(1000)
        continue
      }
      throw new Error(`Rate limited fetching Met object ${objectID}`)
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Met object ${objectID}: ${response.status} ${response.statusText}`
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json()

    return {
      objectID: data.objectID ?? objectID,
      title: data.title ?? "",
      primaryImage: data.primaryImage ?? "",
      primaryImageSmall: data.primaryImageSmall ?? "",
      objectDate: data.objectDate ?? "",
      culture: data.culture ?? "",
      medium: data.medium ?? "",
      department: data.department ?? "",
      creditLine: data.creditLine ?? "",
      accessionYear: data.accessionYear ?? "",
      country: data.country ?? "",
      region: data.region ?? "",
      city: data.city ?? "",
    }
  }

  throw new Error(`Failed to fetch Met object ${objectID} after ${retries} retries`)
}

export { fetchMetObjectWithRetry as fetchMetObject }

export async function prefetchDailyObjects(
  seeds: SeedObject[]
): Promise<(MetObject | null)[]> {
  const BATCH_SIZE = 5
  const BATCH_DELAY_MS = 50
  const results: (MetObject | null)[] = []

  for (let i = 0; i < seeds.length; i += BATCH_SIZE) {
    const batch = seeds.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map((seed) => fetchMetObjectWithRetry(seed.objectID))
    )
    for (const result of batchResults) {
      results.push(result.status === "fulfilled" ? result.value : null)
    }
    if (i + BATCH_SIZE < seeds.length) {
      await delay(BATCH_DELAY_MS)
    }
  }

  return results
}
