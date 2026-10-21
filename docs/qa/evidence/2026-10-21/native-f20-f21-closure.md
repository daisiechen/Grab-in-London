# F20/F21 targeted native defect acceptance

Native owner executed actual headless Release builds/install/launch. Independent QA read original logs, reviewed pixels and matched source bytes; QA did not control native UI. [Machine review](native-f20-f21-owner-runtime-review.json) contains hashes and exact scope.

F20: precise unpatched87434e3 runtime reproduces defineProperty undefined/RCTFatal. Exact formal9df archive build succeeds, installs/opens, real Discover screen and no captured fatal. QA separately verified formal9df resolver7 and actual Metro/Hermes CJS200/ESM0 and106 exact app source files. Startup-only defect CLOSED_TARGETED_QA. Original red and9df statusbar-overlap screenshot retained.

F21: formal5b AppRoot/metro byte-identical to executed native source; actual9df archive plus sole runtime AppRoot change matches formal5b production code, while complete5b archive repeat was still building at review. New actual screen shows heading below statusbar with nonzero top inset. Standard pnpm targeted10PASS includes safe-region consent/decline/offline-banner and existing resolver. CLOSED_TARGETED_QA limited to first-screen overlap.

R113 direct node Jest bypassed standard package test environment and failed to load Babel runtime for safearea suite; retained as setup failure, not product red. R114 documented pnpm command passes10, no dependency/config/expectation changes. Original F20 crash and F21 overlapping screen remain.

No claim of actual native taps, complete account/host role swap, device farm, live identity/maps/model/mail or release readiness. JOURNEY001/002 remainNOT_RUN;144PASS/61NOT_RUN/12BLOCKED unchanged by closing these targeted defects.
