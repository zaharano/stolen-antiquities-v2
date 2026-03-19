/**
 * curate-seed-list.ts
 *
 * Parses MetObjects.csv and filters to public-domain highlighted objects
 * that have a non-empty Country field. Outputs scripts/candidates.json.
 *
 * Run: npx tsx scripts/curate-seed-list.ts
 */

import { createReadStream, writeFileSync } from "fs";
import { parse } from "csv-parse";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

interface Candidate {
  objectID: number;
  title: string;
  culture: string;
  country: string;
  region: string;
  city: string;
  medium: string;
  department: string;
  objectDate: string;
}

const CSV_PATH = path.join(projectRoot, "MetObjects.csv");
const OUTPUT_PATH = path.join(__dirname, "candidates.json");

async function main(): Promise<void> {
  const candidates: Candidate[] = [];
  let totalRows = 0;

  const parser = createReadStream(CSV_PATH).pipe(
    parse({
      columns: (header: string[]) =>
        // Strip BOM from first column name if present
        header.map((col) => col.replace(/^\uFEFF/, "").trim()),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    })
  );

  for await (const row of parser) {
    totalRows++;

    // Filter: must be public domain, a highlight, and have a country
    if (
      row["Is Public Domain"] !== "True" ||
      row["Is Highlight"] !== "True" ||
      !row["Country"] ||
      row["Country"].trim() === ""
    ) {
      continue;
    }

    const objectID = parseInt(row["Object ID"], 10);
    if (isNaN(objectID) || objectID <= 0) continue;

    candidates.push({
      objectID,
      title: (row["Title"] ?? "").trim(),
      culture: (row["Culture"] ?? "").trim(),
      country: (row["Country"] ?? "").trim(),
      region: (row["Region"] ?? "").trim(),
      city: (row["City"] ?? "").trim(),
      medium: (row["Medium"] ?? "").trim(),
      department: (row["Department"] ?? "").trim(),
      objectDate: (row["Object Date"] ?? "").trim(),
    });
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(candidates, null, 2), "utf-8");

  console.log(`\n=== Curation Results ===`);
  console.log(`Total CSV rows processed: ${totalRows.toLocaleString()}`);
  console.log(`Candidates matching filters: ${candidates.length}`);
  console.log(`Output written to: ${OUTPUT_PATH}`);

  // Print unique country breakdown
  const countryCounts: Record<string, number> = {};
  for (const c of candidates) {
    countryCounts[c.country] = (countryCounts[c.country] ?? 0) + 1;
  }
  const sortedCountries = Object.entries(countryCounts).sort(
    (a, b) => b[1] - a[1]
  );
  console.log(`\nTop countries (${Object.keys(countryCounts).length} unique):`);
  for (const [country, count] of sortedCountries.slice(0, 20)) {
    console.log(`  ${country}: ${count}`);
  }

  // Print unique city breakdown
  const cityCounts: Record<string, number> = {};
  for (const c of candidates) {
    if (c.city) {
      cityCounts[c.city] = (cityCounts[c.city] ?? 0) + 1;
    }
  }
  const sortedCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);
  console.log(
    `\nTop cities (${Object.keys(cityCounts).length} unique cities, ${candidates.filter((c) => c.city).length} candidates with city):`
  );
  for (const [city, count] of sortedCities.slice(0, 20)) {
    console.log(`  ${city}: ${count}`);
  }

  // Print unique region breakdown
  const regionCounts: Record<string, number> = {};
  for (const c of candidates) {
    if (c.region) {
      regionCounts[c.region] = (regionCounts[c.region] ?? 0) + 1;
    }
  }
  const sortedRegions = Object.entries(regionCounts).sort(
    (a, b) => b[1] - a[1]
  );
  console.log(
    `\nTop regions (${Object.keys(regionCounts).length} unique regions):`
  );
  for (const [region, count] of sortedRegions.slice(0, 20)) {
    console.log(`  ${region}: ${count}`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
