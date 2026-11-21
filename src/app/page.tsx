
// Next.js ko batata hai ki ye component browser mein chalega (kyunki isme buttons aur state hain)
"use client";

import { useState } from "react";
import Editor from "@monaco-editor/react"; // VS Code wala actual code editor
import { Play, FileCode, RotateCcw, Terminal, Clock, CheckCircle2, XCircle } from "lucide-react"; // Clean UI icons
import { STARTER_PROBLEM } from "@/data/starterProblem"; // Apna Problem #1 (Counter.java + Main.java)

// Backend (/api/run) se jo JSON response wapas aayega, uska fixed shape (TypeScript contract)
interface RunResult {
  success: boolean;    // Code pass hua ya fail
  stage?: string;      // Agar fail hua toh compile stage pe ya run stage pe
  stdout?: string;     // System.out.println() ka output
  stderr?: string;     // Errors ya System.err.println() ka output
  durationMs?: number; // Total kitne milliseconds lage (cold/warm latency)
}

export default function Home() {
  // 1. Virtual File System (VFS): Saari files aur unka current code browser ki memory mein store hai
  const [files, setFiles] = useState<Record<string, string>>(STARTER_PROBLEM.files);

  // 2. Konsi file abhi editor mein khuli hai (default: pehli file, yaani Counter.java)
  const [activeFile, setActiveFile] = useState<string>(Object.keys(STARTER_PROBLEM.files)[0]);

  // 3. Loading state: Jab code Modal sandbox mein chal raha ho tab button disable karne ke liye
  const [isRunning, setIsRunning] = useState(false);

  // 4. Sandbox se aaya hua final output yahan store hoga
  const [result, setResult] = useState<RunResult | null>(null);

  // Jab bhi user Monaco editor mein kuch type kare, sirf activeFile ka code update karo (baaki files same rahengi)
  const handleCodeChange = (value: string | undefined) => {
    if (value === undefined) return;
    setFiles((prev) => ({ ...prev, [activeFile]: value }));
  };

  // Reset button dabane par saara code wapas original buggy version pe le aao aur console clear karo
  const handleReset = () => {
    setFiles(STARTER_PROBLEM.files);
    setResult(null);
  };

  // Run Code button dabane par ye function chalta hai: Browser -> Next.js (/api/run) -> Modal Java Sandbox
  const handleRun = async () => {
    setIsRunning(true); // Loading start
    setResult(null);    // Purana output hatao

    try {
      // Apne Next.js backend ko POST request bhej rahe hain saari files ke saath
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryClass: STARTER_PROBLEM.entryClass, // Modal ko batana ki "Main" class run karni hai
          files,                                  // Pura VFS HashMap JSON ban ke jayega
        }),
      });

      // Backend se jo JSON wapas aaya usko state mein save kar do taaki console mein dikhe
      const data: RunResult = await res.json();
      setResult(data);
    } catch {
      // Agar Next.js server band ho ya internet chala jaye toh ye fallback error dikhao
      setResult({ success: false, stderr: "Network error: could not reach /api/run." });
    } finally {
      setIsRunning(false); // Chahe pass ho ya fail, loading band karo
    }
  };

  return (
    // Poori screen ka dark background layout (h-screen = 100% height)
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      
      {/* ==================== TOP NAVBAR ==================== */}
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        {/* Left side: Brand name + Badge */}
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight text-emerald-400">DebugRep</span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
            Java 21 Sandbox
          </span>
        </div>

        {/* Right side: Reset aur Run Code buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>

          <button
            onClick={handleRun}
            disabled={isRunning} // Run chalte waqt double-click rokne ke liye
            className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {isRunning ? "Running in Sandbox..." : "Run Code"}
          </button>
        </div>
      </header>

      {/* ==================== MAIN SPLIT WORKSPACE ==================== */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT SIDEBAR: Problem Statement + File Explorer */}
        <aside className="flex w-72 flex-col border-r border-zinc-800 bg-zinc-900/50">
          {/* Problem Title, Difficulty, aur Description */}
          <div className="border-b border-zinc-800 p-4">
            <div className="mb-1 flex items-center justify-between">
              <h1 className="font-semibold text-zinc-100">{STARTER_PROBLEM.title}</h1>
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                {STARTER_PROBLEM.difficulty}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              {STARTER_PROBLEM.description}
            </p>
          </div>

          {/* File Explorer: VFS ke har filename ke liye ek clickable button banata hai */}
          <div className="p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Files
            </div>
            <div className="flex flex-col gap-1">
              {Object.keys(files).map((filename) => (
                <button
                  key={filename}
                  onClick={() => setActiveFile(filename)} // Click karne pe editor is file pe switch ho jayega
                  className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-left text-sm ${
                    activeFile === filename
                      ? "bg-zinc-800 font-medium text-emerald-400" // Active file highlight
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                  }`}
                >
                  <FileCode className="h-4 w-4 shrink-0" />
                  {filename}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* RIGHT AREA: Upar Monaco Editor, Neeche Output Console */}
        <main className="flex flex-1 flex-col overflow-hidden">
          
          {/* CODE EDITOR (Monaco) */}
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              language="java"           // Java syntax highlighting on
              theme="vs-dark"           // VS Code dark theme
              path={activeFile}         // Har file ki apni alag undo/redo history maintain karta hai
              value={files[activeFile]} // Active file ka code dikhao
              onChange={handleCodeChange}
              options={{
                minimap: { enabled: false }, // Right side ka chhota map band rakho clean look ke liye
                fontSize: 14,
                scrollBeyondLastLine: false,
                automaticLayout: true,       // Window resize hone pe editor khud adjust ho jaye
              }}
            />
          </div>

          {/* OUTPUT CONSOLE */}
          <div className="flex h-52 flex-col border-t border-zinc-800 bg-zinc-950">
            {/* Console Header: Title + Pass/Fail Badge + Latency (ms) */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2 text-xs">
              <div className="flex items-center gap-2 font-medium text-zinc-400">
                <Terminal className="h-4 w-4" />
                Console Output
              </div>

              {/* Agar result aa gaya hai toh Pass/Fail aur durationMs dikhao */}
              {result && (
                <div className="flex items-center gap-3">
                  {result.success ? (
                    <span className="flex items-center gap-1 font-medium text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> Passed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-medium text-rose-400">
                      <XCircle className="h-4 w-4" /> Failed ({result.stage || "error"})
                    </span>
                  )}

                  {result.durationMs !== undefined && (
                    <span className="flex items-center gap-1 text-zinc-400">
                      <Clock className="h-3.5 w-3.5" />
                      {result.durationMs} ms
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Console Body: Actual stdout / stderr logs */}
            <div className="flex-1 overflow-auto p-4 font-mono text-xs">
              {isRunning && (
                <p className="text-zinc-400">Compiling &amp; executing in isolated Java 21 container...</p>
              )}

              {!isRunning && !result && (
                <p className="text-zinc-500">Click &quot;Run Code&quot; to execute your Java files in the cloud sandbox.</p>
              )}

              {!isRunning && result && (
                <div className="space-y-2">
                  {/* Normal output (white/grey) */}
                  {result.stdout && (
                    <pre className="whitespace-pre-wrap text-zinc-200">{result.stdout}</pre>
                  )}
                  {/* Error output (red) */}
                  {result.stderr && (
                    <pre className="whitespace-pre-wrap text-rose-400">{result.stderr}</pre>
                  )}
                </div>
              )}
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
