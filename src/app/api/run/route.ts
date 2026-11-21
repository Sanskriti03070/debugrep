import { NextResponse } from "next/server";

// Security Limits (Bouncer rules: ye cross kiya toh Modal tak request jayegi hi nahi)
const MAX_FILES = 20;
const MAX_TOTAL_BYTES = 100 * 1024; // 100 KB max total code size

// Safe filename regex: sirf letters, numbers, folders (/), underscores, aur .java allowed
const SAFE_PATH_REGEX = /^[a-zA-Z0-9_/-]+\.java$/;

// Safe Java class name regex: e.g., "Main" ya "com.app.Main" (no spaces, no shell characters)
const SAFE_CLASS_REGEX = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { entryClass, files } = body;

    // 1. Basic structure check: entryClass string hona chahiye aur files ek non-empty object
    if (
      typeof entryClass !== "string" ||
      !SAFE_CLASS_REGEX.test(entryClass)
    ) {
      return NextResponse.json(
        { success: false, stage: "validation", stderr: "Invalid entryClass name." },
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

    // 2. File count check: koi 10,000 files bhej ke server crash na kar de
    if (fileEntries.length === 0 || fileEntries.length > MAX_FILES) {
      return NextResponse.json(
        { success: false, stage: "validation", stderr: `File count must be between 1 and ${MAX_FILES}.` },
        { status: 400 }
      );
    }

    let totalBytes = 0;

    // 3. Har ek file ko inspect karo (Path Traversal + Size Bomb protection)
    for (const [filename, content] of fileEntries) {
      if (typeof content !== "string") {
        return NextResponse.json(
          { success: false, stage: "validation", stderr: `Invalid content for file: ${filename}` },
          { status: 400 }
        );
      }

      // Path Traversal check: "..", leading "/", ya illegal characters turant block karo
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

    // 4. Sab clean hai! Ab Modal sandbox URL check karke request forward karo
    const modalUrl = process.env.MODAL_JAVA_RUNNER_URL;
    if (!modalUrl) {
      return NextResponse.json(
        { success: false, stderr: "Server misconfiguration: MODAL_JAVA_RUNNER_URL is missing." },
        { status: 500 }
      );
    }

    const modalRes = await fetch(modalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryClass, files }),
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
