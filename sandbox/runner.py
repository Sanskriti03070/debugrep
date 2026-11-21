import modal
import subprocess
import tempfile
import os

# 1. Define the Modal app
app = modal.App("debugrep-java-runner")

# 2. Pre-bake a lightweight Linux container with Java 21 + FastAPI
java_image = (
    modal.Image.debian_slim()
    .apt_install("openjdk-21-jdk")
    .pip_install("fastapi[standard]")
)

# 3. Expose an isolated HTTPS endpoint with a strict 15-second timeout
@app.function(image=java_image, timeout=15)
@modal.fastapi_endpoint(method="POST")
def run_java(payload: dict):
    """
    Expects JSON:
    {
      "files": { "Main.java": "public class Main { ... }" },
      "entryClass": "Main"
    }
    """
    files = payload.get("files", {})
    entry_class = payload.get("entryClass", "Main")

    if not files:
        return {"success": False, "stdout": "", "stderr": "No files provided."}

    # Create a temporary directory inside the isolated container
    with tempfile.TemporaryDirectory() as tmpdir:
        java_files = []

        # Write all virtual files to disk (preserving nested folders)
        for filepath, content in files.items():
            full_path = os.path.join(tmpdir, filepath)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w") as f:
                f.write(content)
            if filepath.endswith(".java"):
                java_files.append(full_path)

        # Step A: Compile all .java files
        compile_proc = subprocess.run(
            ["javac", "-d", tmpdir] + java_files,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if compile_proc.returncode != 0:
            return {
                "success": False,
                "stage": "compile",
                "stdout": compile_proc.stdout,
                "stderr": compile_proc.stderr,
            }

        # Step B: Execute the entry class
        run_proc = subprocess.run(
            ["java", "-cp", tmpdir, entry_class],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return {
            "success": run_proc.returncode == 0,
            "stage": "run",
            "stdout": run_proc.stdout,
            "stderr": run_proc.stderr,
        }