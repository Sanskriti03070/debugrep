import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { files, entryClass } = body;

    if (!files || typeof files !== "object") {
      return NextResponse.json(
        { success: false, stderr: "Missing or invalid 'files' payload." },
        { status: 400 }
      );
    }

    const modalUrl = process.env.MODAL_JAVA_RUNNER_URL;
    if (!modalUrl) {
      return NextResponse.json(
        { success: false, stderr: "Server misconfiguration: MODAL_JAVA_RUNNER_URL is not set." },
        { status: 500 }
      );
    }

    const response = await fetch(modalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files, entryClass: entryClass || "Main" }),
    });

    const data = await response.json();
    const durationMs = Date.now() - startTime;

    return NextResponse.json({ ...data, durationMs });
  } catch (error) {
    console.error("Error executing code in sandbox:", error);
    return NextResponse.json(
      { success: false, stderr: "Failed to execute code in sandbox.", durationMs: Date.now() - startTime },
      { status: 500 }
    );
  }
}
