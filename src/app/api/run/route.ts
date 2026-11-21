import { NextResponse } from "next/server";
import { HIDDEN_TESTS } from "@/data/hiddenTests";

// Security Limits (Front-door bouncer rules)
const MAX_FILES = 20;
const MAX_TOTAL_BYTES = 100 * 1024; // 100 KB max
const SAFE_PATH_REGEX = /^[a-zA-Z0-9_/-]+\.java$/;

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { problemId, files } = body;

    // 1. Server-side lookup: problemId se hidden tests aur entryClass nikalo (browser pe trust mat karo!)
    const hiddenConfig = typeof problemId === "string" ? HIDDEN_TESTS[problemId] : undefined;
    if (!hiddenConfig) {
      return NextResponse.json(
        { success: false, stage: "validation", stderr: `Unknown problemId: "${problemId}".` },
        { status: 400 }
      );
    }

    if (!files || typeof files !== "object" || Array.isArray(files)) {
      return NextResponse.json(
        { success: false, stage: "validation", stderr: "Files must be a valid key-value map." },
        { status: 400 }
      );
    }

    const fileEntries = Object.entries(files);
    if (fileEntries.length === 0 || fileEntries.length > MAX_FILES) {
      return NextResponse.json(
        { success: false, stage: "validation", stderr: `File count must be between 1 and ${MAX_FILES}.` },
        { status: 400 }
      );
    }

    let totalBytes = 0;

    // 2. Har user file ko validate karo (Path Traversal + Payload Size Bomb check)
    for (const [filename, content] of fileEntries) {
      if (typeof content !== "string") {
        return NextResponse.json(
          { success: false, stage: "validation", stderr: `Invalid content for file: ${filename}` },
          { status: 400 }
        );
      }

      if (
        filename.includes("..") ||
        filename.startsWith("/") ||
        !SAFE_PATH_REGEX.test(filename)
      ) {
        return NextResponse.json(
          {
            success: false,
            stage: "validation",
            stderr: `Security Violation: Illegal file path "${filename}".`,
          },
          { status: 400 }
        );
      }

      totalBytes += Buffer.byteLength(content, "utf8");
      if (totalBytes > MAX_TOTAL_BYTES) {
        return NextResponse.json(
          {
            success: false,
            stage: "validation",
            stderr: `Payload too large. Max allowed size is ${MAX_TOTAL_BYTES / 1024} KB.`,
          },
          { status: 400 }
        );
      }
    }

    // 3. ANTI-CHEAT INJECTION: User files ke upar server ke hidden tests merge karo
    // Agar user ne fake HiddenGrader.java bheja bhi hoga, toh server wala usko overwrite kar dega!
    const mergedFiles = {
      ...files,
      ...hiddenConfig.testFiles,
    };

    const modalUrl = process.env.MODAL_JAVA_RUNNER_URL;
    if (!modalUrl) {
      return NextResponse.json(
        { success: false, stderr: "Server misconfiguration: MODAL_JAVA_RUNNER_URL is missing." },
        { status: 500 }
      );
    }

    // 4. Merged VFS ko Modal Java 21 sandbox mein bhejo
    const modalRes = await fetch(modalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryClass: hiddenConfig.entryClass,
        files: mergedFiles,
      }),
    });

    if (!modalRes.ok) {
      return NextResponse.json(
        {
          success: false,
          stderr: `Sandbox returned HTTP ${modalRes.status}.`,
          durationMs: Date.now() - startTime,
        },
        { status: 502 }
      );
    }

    const data = await modalRes.json();

    return NextResponse.json({
      ...data,
      durationMs: Date.now() - startTime,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        stderr: "Failed to execute code in sandbox.",
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
