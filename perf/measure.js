/** Retry only a missing Chromium navigation trace, once, never a measured score.
 * Upstream: https://github.com/GoogleChrome/lighthouse/issues/15382
 */
export async function withNavigationRetry(measure, retainInvalid) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await measure();
    if (!result.lhr.runtimeError) return result;
    const raw = result.lhr.runtimeError.code;
    const code =
      typeof raw === "string" && /^[A-Z][A-Z_]{0,63}$/.test(raw)
        ? raw
        : "lighthouse_runtime_error";
    await retainInvalid(result, attempt, code);
    if (raw !== "NO_NAVSTART" || attempt === 1) {
      const error = new Error("Invalid Lighthouse run");
      error.failureCode = code;
      throw error;
    }
  }
}
