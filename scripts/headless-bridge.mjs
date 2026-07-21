#!/usr/bin/env node
/**
 * Headless RYU bridge — shared core, no Electron UI.
 * Usage: node scripts/headless-bridge.mjs [port]
 */

import { RyuBridgeCore } from '../shared/bridge-core.mjs'

const PORT = Number(process.argv[2] || process.env.RYU_PORT || 41999)
const requireAuth = process.env.RYU_AUTH === '0' ? false : true

const bridge = new RyuBridgeCore({
  port: PORT,
  headless: true,
  requireAuth
})

await bridge.start()
console.log(`[headless-bridge] listening 127.0.0.1:${PORT} auth=${requireAuth}`)
if (requireAuth) {
  console.log(`[headless-bridge] token written to ~/.ryu/token`)
}

function shutdown() {
  bridge.stop()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
