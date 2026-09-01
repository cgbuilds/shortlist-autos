import { formatProbe, loadLocalEnv, probeMarketCheck } from "../src/lib/marketcheck-probe.ts";

loadLocalEnv();
const probe = await probeMarketCheck();
process.stdout.write(`${formatProbe(probe)}\n`);
process.exit(probe.ok ? 0 : 1);
