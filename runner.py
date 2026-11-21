import os
import subprocess
import tempfile
import modal

# Modal App aur Java 21 container image define kar rahe hain
app = modal.App("debugrep-java-sandbox")
image = (
    modal.Image.debian_slim()
    .apt_install("openjdk-21-jdk-headless")
    .pip_install("fastapi[standard]")
)

# Hard Sandbox Limits (Container ko crash hone se bachane ke liye)
COMPILE_TIMEOUT_SEC = 10
RUN_TIMEOUT_SEC = 5
MAX_OUTPUT_CHARS = 10_000  # 10 KB max stdout/stderr (log flooding rokne ke liye)


def truncate(text: str) -> str:
    """Agar output bahut bada ho toh kaat do taaki JSON payload fat na jaye"""
    if not text:
        return ""
    if len(text) > MAX_OUTPUT_CHARS:
        return text[:MAX_OUTPUT_CHARS] + "\n... [Output truncated: exceeded 10KB limit]"
    return text


@app.function(image=image, timeout=30)
@modal.fastapi_endpoint(method="POST")
def run_java(payload: dict):
    entry_class = payload.get("entryClass", "Main")
    files = payload.get("files", {})

    if not files:
        return {"success": False, "stage": "validation", "stderr": "No files provided."}

    # Har run ke liye ek fresh temporary folder banta hai (run khatam hote hi delete)
    with tempfile.TemporaryDirectory() as tmp_dir:
        base_dir = os.path.realpath(tmp_dir)
        java_files = []

        # 1. Saari VFS files ko temp folder mein write karo (Defense-in-Depth path check ke saath)
        for filename, content in files.items():
            full_path = os.path.realpath(os.path.join(base_dir, filename))

            # Security check: agar path tmp_dir se bahar ja raha hai (e.g., ../../evil.java), turant roko
            if not full_path.startswith(base_dir + os.sep):
                return {
                    "success": False,
                    "stage": "validation",
                    "stderr": f"Sandbox Security Violation: Path escape attempt ({filename}).",
                }

            # Nested folders (e.g., src/Main.java) ke liye parent directories banao
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)

            if full_path.endswith(".java"):
                java_files.append(full_path)

        # 2. COMPILE STAGE (javac)
        try:
            compile_proc = subprocess.run(
                ["javac", "-d", base_dir] + java_files,
                capture_output=True,
                text=True,
                timeout=COMPILE_TIMEOUT_SEC,
            )
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "stage": "compile",
                "stdout": "",
                "stderr": f"Compilation Timed Out ({COMPILE_TIMEOUT_SEC}s limit).",
            }

        if compile_proc.returncode != 0:
            return {
                "success": False,
                "stage": "compile",
                "stdout": truncate(compile_proc.stdout),
                "stderr": truncate(compile_proc.stderr),
            }

        # 3. RUN STAGE (java with 128MB heap cap + 5s hard timeout)
        try:
            run_proc = subprocess.run(
                ["java", "-Xmx128m", "-cp", base_dir, entry_class],
                capture_output=True,
                text=True,
                timeout=RUN_TIMEOUT_SEC,
            )
        except subprocess.TimeoutExpired as e:
            # Infinite loop pakda gaya! Clean TLE message wapas bhejo
            partial_out = e.stdout.decode("utf-8", errors="replace") if isinstance(e.stdout, bytes) else (e.stdout or "")
            return {
                "success": False,
                "stage": "run",
                "stdout": truncate(partial_out),
                "stderr": f"Time Limit Exceeded ({RUN_TIMEOUT_SEC}s limit). Check for infinite loops.",
            }

        return {
            "success": run_proc.returncode == 0,
            "stage": "run",
            "stdout": truncate(run_proc.stdout),
            "stderr": truncate(run_proc.stderr),
        }
