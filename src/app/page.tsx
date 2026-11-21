"use client";

import { useState, useMemo } from "react";
import Editor from "@monaco-editor/react";
import {
  Play,
  FileCode,
  RotateCcw,
  Terminal,
  Clock,
  CheckCircle2,
  XCircle,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { PROBLEMS } from "@/data/problems";

// Backend (/api/run) se jo JSON response aayega, uska fixed shape
interface RunResult {
  success: boolean;
  stage?: string;
  stdout?: string;
  stderr?: string;
  durationMs?: number;
}

// Recursive Tree Node: har folder ya file ko sidebar mein dikhane ke liye
interface TreeNode {
  name: string;        // e.g., "Inventory.java" ya "model"
  path: string;        // e.g., "src/main/java/com/debugrep/model/Inventory.java"
  isFolder: boolean;
  children: TreeNode[];
}

// Flat VFS paths ("a/b/c.java") ko nested Folder Tree mein convert karne ka helper
function buildFileTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const fullPath of paths) {
    const parts = fullPath.split("/");
    let currentLevel = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === parts.length - 1;

      let existing = currentLevel.find((node) => node.name === part);
      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          isFolder: !isFile,
          children: [],
        };
        currentLevel.push(existing);
      }
      currentLevel = existing.children;
    });
  }

  // Folders upar, files neeche (alphabetical order mein sort karo)
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortNodes(n.children));
  };

  sortNodes(root);
  return root;
}

export default function Home() {
  // Abhi ke liye list ka pehla problem load kar rahe hain
  const problem = PROBLEMS[0];

  // 1. Virtual File System (VFS): Saari files aur unka edited code
  const [files, setFiles] = useState<Record<string, string>>(problem.files);

  // 2. Currently open file in Monaco Editor
  const [activeFile, setActiveFile] = useState<string>(Object.keys(problem.files)[0]);

  // 3. Track which folders are collapsed (default: saare folders open rahenge)
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  // 4. Execution state & console output
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  // File tree sirf tab rebuild karo jab file keys change hon (performance optimization)
  const fileTree = useMemo(() => buildFileTree(Object.keys(files)), [files]);

  const toggleFolder = (folderPath: string) => {
    setCollapsedFolders((prev) => ({ ...prev, [folderPath]: !prev[folderPath] }));
  };

  const handleCodeChange = (value: string | undefined) => {
    if (value === undefined) return;
    setFiles((prev) => ({ ...prev, [activeFile]: value }));
  };

  const handleReset = () => {
    setFiles(problem.files);
    setResult(null);
  };

  // Run Code: Sirf problemId aur user files bhejo — hidden tests server khud inject karega!
  const handleRun = async () => {
    setIsRunning(true);
    setResult(null);

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId: problem.id,
          files,
        }),
      });
      const data: RunResult = await res.json();
      setResult(data);
    } catch {
      setResult({ success: false, stderr: "Network error: could not reach /api/run." });
    } finally {
      setIsRunning(false);
    }
  };

  // Recursive component jo sidebar mein nested folders aur files render karta hai
  const renderTree = (nodes: TreeNode[], depth = 0) => {
    return nodes.map((node) => {
      const isCollapsed = !!collapsedFolders[node.path];

      if (node.isFolder) {
        return (
          <div key={node.path}>
            <button
              onClick={() => toggleFolder(node.path)}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              className="flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left text-xs text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            >
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              )}
              {isCollapsed ? (
                <Folder className="h-3.5 w-3.5 shrink-0 text-amber-400/80" />
              ) : (
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-400/80" />
              )}
              <span className="truncate">{node.name}</span>
            </button>
            {!isCollapsed && <div>{renderTree(node.children, depth + 1)}</div>}
          </div>
        );
      }

      // Leaf node (actual .java file)
      const isActive = activeFile === node.path;
      return (
        <button
          key={node.path}
          onClick={() => setActiveFile(node.path)}
          style={{ paddingLeft: `${depth * 12 + 24}px` }}
          className={`flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left text-xs ${
            isActive
              ? "bg-zinc-800 font-medium text-emerald-400"
              : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
          }`}
        >
          <FileCode className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>
      );
    });
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* ==================== TOP NAVBAR ==================== */}
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight text-emerald-400">DebugRep</span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
            Java 21 Sandbox
          </span>
        </div>

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
            disabled={isRunning}
            className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {isRunning ? "Running Hidden Tests..." : "Run Tests"}
          </button>
        </div>
      </header>

      {/* ==================== MAIN SPLIT WORKSPACE ==================== */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR: Problem Statement + Collapsible Repo Explorer */}
        <aside className="flex w-80 flex-col border-r border-zinc-800 bg-zinc-900/50">
          <div className="border-b border-zinc-800 p-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h1 className="font-semibold text-zinc-100">{problem.title}</h1>
              <span className="shrink-0 rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                {problem.difficulty}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              {problem.description}
            </p>
          </div>

          <div className="flex-1 overflow-auto p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Repository Explorer
            </div>
            <div className="space-y-0.5">{renderTree(fileTree)}</div>
          </div>
        </aside>

        {/* RIGHT AREA: Breadcrumb + Monaco Editor + Output Console */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Active File Breadcrumb */}
          <div className="flex items-center border-b border-zinc-800 bg-zinc-900/80 px-4 py-1.5 font-mono text-xs text-zinc-400">
            {activeFile}
          </div>

          {/* CODE EDITOR */}
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              language="java"
              theme="vs-dark"
              path={activeFile}
              value={files[activeFile]}
              onChange={handleCodeChange}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>

          {/* OUTPUT CONSOLE */}
          <div className="flex h-52 flex-col border-t border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2 text-xs">
              <div className="flex items-center gap-2 font-medium text-zinc-400">
                <Terminal className="h-4 w-4" />
                Hidden Test Runner Output
              </div>

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

            <div className="flex-1 overflow-auto p-4 font-mono text-xs">
              {isRunning && (
                <p className="text-zinc-400">Injecting hidden tests &amp; executing in Java 21 sandbox...</p>
              )}
              {!isRunning && !result && (
                <p className="text-zinc-500">Click &quot;Run Tests&quot; to grade your fix against the server-side test suite.</p>
              )}
              {!isRunning && result && (
                <div className="space-y-2">
                  {result.stdout && (
                    <pre className="whitespace-pre-wrap text-zinc-200">{result.stdout}</pre>
                  )}
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
