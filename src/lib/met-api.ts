import type { MetObject, SeedObject } from "../types"

const BASE_URL = "https://collectionapi.metmuseum.org/public/collection/v1"

export async function fetchMetObject(objectID: number): Promise<MetObject> {
  const response = await fetch(`${BASE_URL}/objects/${objectID}`)
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

export async function prefetchDailyObjects(
  seeds: SeedObject[]
): Promise<(MetObject | null)[]> {
  const results = await Promise.allSettled(
    seeds.map((seed) => fetchMetObject(seed.objectID))
  )

  return results.map((result) => {
    if (result.status === "fulfilled") {
      return result.value
    }
    return null
  })
}
