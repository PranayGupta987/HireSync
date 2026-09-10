import axiosInstance from "./axios";

/**
 * @param {string} language - programming language
 * @param {string} code - source code to execute
 * @returns {Promise<{success:boolean, output?:string, error?: string}>}
 */
export async function executeCode(language, code) {
  try {
    const { data } = await axiosInstance.post("/code/execute", { language, code });
    return data;
  } catch (error) {
    const apiError = error.response?.data?.error;
    return {
      success: false,
      error: apiError || `Could not reach the code runner: ${error.message}`,
    };
  }
}
