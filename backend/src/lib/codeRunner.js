import { spawn } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { ENV } from "./env.js";

const SUPPORTED_LANGUAGES = ["javascript", "python", "java"];
const MAX_CODE_BYTES = 50_000;
const RUN_TIMEOUT_MS = 8_000;
const JUDGE0_POLL_ATTEMPTS = 20;
const JUDGE0_POLL_MS = 500;

const JUDGE0_LANGUAGE_IDS = {
  javascript: 63, // Node.js
  python: 71, // Python 3
  java: 62, // OpenJDK
};

const FILE_NAMES = {
  javascript: "main.js",
  python: "main.py",
  java: "Solution.java",
};

export function validateExecutionRequest(language, code) {
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    return { ok: false, error: `Unsupported language: ${language}` };
  }

  if (typeof code !== "string" || !code.trim()) {
    return { ok: false, error: "No source code was provided." };
  }

  if (Buffer.byteLength(code, "utf8") > MAX_CODE_BYTES) {
    return { ok: false, error: "Source code is too large to run." };
  }

  return { ok: true };
}

export async function runUserCode(language, code) {
  const validation = validateExecutionRequest(language, code);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }

  const pistonUrl = normalizeBaseUrl(ENV.PISTON_API_URL);
  if (pistonUrl) {
    const pistonResult = await executeWithPiston(pistonUrl, language, code);
    if (pistonResult) return pistonResult;
  }

  const useJudge0 = Boolean(ENV.JUDGE0_API_KEY || ENV.JUDGE0_API_URL || ENV.NODE_ENV === "production");
  if (useJudge0) {
    const judge0Result = await executeWithJudge0(language, code);
    if (judge0Result) return judge0Result;

    if (ENV.NODE_ENV === "production") {
      return {
        success: false,
        error:
          "Code execution is not configured for production. Set JUDGE0_API_KEY (RapidAPI Judge0 CE) or PISTON_API_URL on the backend, then redeploy.",
      };
    }
  }

  return executeLocally(language, code);
}

function normalizeBaseUrl(url) {
  if (!url) return "";
  return String(url).trim().replace(/\/$/, "");
}

function judge0Config() {
  const apiKey = ENV.JUDGE0_API_KEY;
  const host = ENV.JUDGE0_API_HOST || "judge0-ce.p.rapidapi.com";
  const url =
    normalizeBaseUrl(ENV.JUDGE0_API_URL) ||
    (apiKey ? `https://${host}` : "https://ce.judge0.com");

  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["X-RapidAPI-Key"] = apiKey;
    headers["X-RapidAPI-Host"] = host;
  }

  return { url, headers };
}

async function executeWithPiston(pistonUrl, language, code) {
  try {
    const response = await fetch(`${pistonUrl}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language,
        version: "*",
        files: [{ name: FILE_NAMES[language], content: code }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      return {
        success: false,
        error: errorBody?.message || `Piston request failed (HTTP ${response.status}).`,
      };
    }

    const data = await response.json();
    const compileError = data.compile?.stderr || "";
    const run = data.run || {};
    const output = run.stdout || run.output || "";
    const stderr = compileError || run.stderr || "";
    const exitCode = run.code ?? 0;

    if (exitCode !== 0 || (stderr && !output)) {
      return { success: false, output, error: stderr || "Program exited with an error." };
    }

    return { success: true, output: output || "No output" };
  } catch (error) {
    console.error("Piston execution failed", error);
    return null;
  }
}

async function executeWithJudge0(language, code) {
  const { url, headers } = judge0Config();

  try {
    const createResponse = await fetch(`${url}/submissions?base64_encoded=true&wait=false`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        language_id: JUDGE0_LANGUAGE_IDS[language],
        source_code: Buffer.from(code, "utf8").toString("base64"),
      }),
    });

    if (!createResponse.ok) {
      const errorBody = await createResponse.json().catch(() => null);
      console.error("Judge0 create failed", createResponse.status, errorBody);
      return null;
    }

    const created = await createResponse.json();
    if (!created?.token) return null;

    for (let attempt = 0; attempt < JUDGE0_POLL_ATTEMPTS; attempt += 1) {
      await sleep(JUDGE0_POLL_MS);
      const resultResponse = await fetch(
        `${url}/submissions/${created.token}?base64_encoded=true`,
        { headers }
      );

      if (!resultResponse.ok) continue;

      const result = await resultResponse.json();
      const statusId = result.status?.id;
      if (statusId === 1 || statusId === 2) continue;

      const output = decodeBase64(result.stdout);
      const stderr = decodeBase64(result.stderr);
      const compileOutput = decodeBase64(result.compile_output);
      const message = result.status?.description || result.message || "";

      if (statusId === 3) {
        return { success: true, output: output || "No output" };
      }

      return {
        success: false,
        output,
        error: compileOutput || stderr || message || "Code execution failed.",
      };
    }

    return { success: false, error: "Code execution timed out while waiting for the runner." };
  } catch (error) {
    console.error("Judge0 execution failed", error);
    return null;
  }
}

async function executeLocally(language, code) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "Hire-Sync-run-"));

  try {
    const fileName = FILE_NAMES[language];
    const filePath = path.join(tempDir, fileName);
    await writeFile(filePath, code, "utf8");

    if (language === "javascript") {
      return runCommand(process.execPath, [filePath], tempDir);
    }

    if (language === "python") {
      const python = await firstWorkingCommand(
        [
          ["python", ["--version"]],
          ["python3", ["--version"]],
          ["py", ["-3", "--version"]],
        ],
        tempDir
      );
      if (!python) {
        return { success: false, error: "Python is not installed on this machine." };
      }
      const args = python.command === "py" ? ["-3", filePath] : [filePath];
      return runCommand(python.command, args, tempDir);
    }

    const javac = await firstWorkingCommand([["javac", ["-version"]]], tempDir);
    const java = await firstWorkingCommand([["java", ["-version"]]], tempDir);
    if (!javac || !java) {
      return { success: false, error: "Java JDK is not installed on this machine." };
    }

    const compile = await runCommand("javac", [fileName], tempDir);
    if (!compile.success) return compile;
    return runCommand("java", ["-cp", tempDir, "Solution"], tempDir);
  } finally {
    await sleep(50);
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function firstWorkingCommand(candidates, cwd) {
  for (const [command, args] of candidates) {
    const result = await runCommand(command, args, cwd, 3_000);
    if (result.spawned) return { command };
  }
  return null;
}

function runCommand(command, args, cwd, timeoutMs = RUN_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const child = spawn(command, args, {
      cwd,
      env: sandboxEnv(cwd),
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ success: false, spawned: true, error: "Code execution timed out." });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      finish({
        success: false,
        spawned: false,
        error: error.code === "ENOENT" ? `${command} is not available.` : error.message,
      });
    });
    child.on("close", (code) => {
      if (code === 0) {
        finish({ success: true, spawned: true, output: stdout || "No output" });
        return;
      }
      finish({
        success: false,
        spawned: true,
        output: stdout,
        error: stderr || `Program exited with code ${code}.`,
      });
    });

    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    }
  });
}

function decodeBase64(value) {
  if (!value) return "";
  return Buffer.from(value, "base64").toString("utf8");
}

function sandboxEnv(cwd) {
  return {
    PATH: process.env.PATH || "",
    SystemRoot: process.env.SystemRoot || process.env.SYSTEMROOT,
    SYSTEMROOT: process.env.SYSTEMROOT || process.env.SystemRoot,
    WINDIR: process.env.WINDIR,
    COMSPEC: process.env.COMSPEC,
    TEMP: cwd,
    TMP: cwd,
    TMPDIR: cwd,
    LANG: process.env.LANG || "en_US.UTF-8",
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
