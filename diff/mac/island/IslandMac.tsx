/**
 * Mac entry re-exports the shared dock island from src/.
 * Electron shell stays Mac-specific under diff/mac/electron/window.ts.
 */
export { Island as IslandMac } from '../../../src/island/Island'
