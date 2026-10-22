import assert from "node:assert/strict";
import { test } from "node:test";

import { effectiveBlocklist } from "../background/distracting.js";

test("distracting sites are added to the session's blocklist without duplicates", () => {
  assert.deepEqual(
    effectiveBlocklist(["instagram.com", "TikTok.com"], ["Discord", "instagram.com"], []),
    ["discord", "instagram.com", "tiktok.com"],
  );
});

test("a site on the session's allowlist is exempt, e.g. for a social-media assignment", () => {
  assert.deepEqual(
    effectiveBlocklist(["instagram.com", "tiktok.com"], [], [" Instagram.com "]),
    ["tiktok.com"],
  );
});
