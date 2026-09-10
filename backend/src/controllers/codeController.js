import { runUserCode, validateExecutionRequest } from "../lib/codeRunner.js";

export async function executeCode(req, res) {
  try {
    const language = req.body?.language;
    const code = req.body?.code ?? req.body?.files?.[0]?.content;

    const validation = validateExecutionRequest(language, code);
    if (!validation.ok) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const result = await runUserCode(language, code);
    return res.status(200).json({
      success: result.success,
      output: result.output,
      error: result.error,
    });
  } catch (error) {
    console.error("Error in executeCode controller", error);
    return res.status(500).json({
      success: false,
      error: "Code execution failed unexpectedly.",
    });
  }
}
