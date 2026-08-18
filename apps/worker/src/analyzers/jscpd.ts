import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface JscpdClone {
  format: string;
  lines: number;
  tokens: number;
  firstFile: {
    name: string;
    start: number;
    end: number;
  };
  secondFile: {
    name: string;
    start: number;
    end: number;
  };
}

export interface JscpdReport {
  duplicates: JscpdClone[];
  totalLines: number;
  duplicatedLines: number;
  percentage: number;
}

/**
 * Step 53 (B-08): jscpd analyzer wrapper
 * Invokes jscpd CLI or parses output to detect code duplication across project files.
 */
export async function runJscpdAnalyzer(repoPath: string): Promise<JscpdReport> {
  try {
    const { stdout } = await execAsync(
      `npx jscpd "${repoPath}" --reporters json --silent`,
      { maxBuffer: 10 * 1024 * 1024 }
    );

    const parsed = JSON.parse(stdout);
    const duplicates: JscpdClone[] = (parsed.duplicates || []).map((d: any) => ({
      format: d.format || "unknown",
      lines: d.lines || 0,
      tokens: d.tokens || 0,
      firstFile: {
        name: d.firstFile?.name || "",
        start: d.firstFile?.start || 0,
        end: d.firstFile?.end || 0,
      },
      secondFile: {
        name: d.secondFile?.name || "",
        start: d.secondFile?.start || 0,
        end: d.secondFile?.end || 0,
      },
    }));

    return {
      duplicates,
      totalLines: parsed.total?.lines || 0,
      duplicatedLines: parsed.total?.duplicatedLines || 0,
      percentage: parsed.total?.percentage || 0,
    };
  } catch {
    return {
      duplicates: [],
      totalLines: 0,
      duplicatedLines: 0,
      percentage: 0,
    };
  }
}
