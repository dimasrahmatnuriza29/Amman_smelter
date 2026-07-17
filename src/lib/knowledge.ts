import { readFileSync } from "fs";
import { join } from "path";

interface PdfPage {
  page: number;
  content: string;
}

interface PdfJson {
  source: string;
  total_pages: number;
  pages: PdfPage[];
}

let cached: PdfJson | null = null;

function loadPdfJson(): PdfJson {
  if (cached) return cached;
  const filePath = join(process.cwd(), "..", "data", "troubleshooting_guide.json");
  const raw = readFileSync(filePath, "utf-8");
  cached = JSON.parse(raw) as PdfJson;
  return cached;
}

export function getKnowledgeByMachineType(machineType: string): string {
  const data = loadPdfJson();
  const type = machineType.toLowerCase();

  const pageMap: Record<string, number[]> = {
    furnace: [6, 7],
    conveyor: [8],
    slurry_pump: [10, 11],
    motor: [12, 13],
    "slurry pump": [10, 11],
  };

  const targetPages = pageMap[type] ?? [];
  const knowledgePages: string[] = [];

  for (const p of data.pages) {
    if (targetPages.includes(p.page)) {
      knowledgePages.push(`--- Page ${p.page} ---\n${p.content}`);
    }
  }

  // Always include decision workflow + output format + safety
  const criticalPages = [7, 17, 18, 19, 20, 21];
  for (const p of data.pages) {
    if (criticalPages.includes(p.page) && !targetPages.includes(p.page)) {
      knowledgePages.push(`--- Page ${p.page} ---\n${p.content}`);
    }
  }

  return knowledgePages.join("\n\n");
}

export function getGeneralKnowledge(): string {
  const data = loadPdfJson();
  return data.pages
    .map((p) => `--- Page ${p.page} ---\n${p.content}`)
    .join("\n\n");
}
