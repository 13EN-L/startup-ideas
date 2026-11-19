import fc from 'fast-check';

// FC_NUM_RUNS raises the run count for a deeper local or nightly search;
// FC_SEED replays a failure printed by an earlier run.
fc.configureGlobal({
  numRuns: Number(process.env.FC_NUM_RUNS ?? 100),
  ...(process.env.FC_SEED ? { seed: Number(process.env.FC_SEED) } : {}),
});
