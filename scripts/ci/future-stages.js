// Never propagate command output or validator details: they can contain local keys.
export function runFutureStages(actions, record) {
  let failure;
  const run = (name) => {
    try {
      record(name, actions[name]);
    } catch {
      throw new Error(`Required suite stage failed: ${name}`);
    }
  };
  try {
    for (const name of ["startup", "reset", "rls", "integration"]) {
      if (actions[name]) run(name);
    }
  } catch (error) {
    failure = error;
  } finally {
    try {
      run("cleanup");
    } catch (error) {
      failure = failure
        ? new Error(`${failure.message}; cleanup also failed`)
        : error;
    }
  }
  if (failure) throw failure;
}
