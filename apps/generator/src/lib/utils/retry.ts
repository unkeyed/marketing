export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts: number; label?: string },
): Promise<T> {
  let lastError: Error;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < opts.maxAttempts) {
        const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
        console.warn(
          `[retry] ${opts.label || "task"} attempt ${attempt}/${opts.maxAttempts} failed, retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError!;
}
