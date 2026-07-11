/**
 * db.ts — PocketBase client singleton + connection helpers.
 * ----------------------------------------------------------------------------
 * Provides a single `pb` instance, a connection check (`isConnected`),
 * and an `initDB()` entry point that the app calls on startup.
 *
 * Graceful degradation: if PocketBase is not running, `usePocketBase()`
 * returns false and all data access falls back to in-memory mock data.
 */
import PocketBase from "pocketbase";

const PB_URL = import.meta.env.VITE_PB_URL || "http://127.0.0.1:8090";

export const pb = new PocketBase(PB_URL);

export async function isConnected(): Promise<boolean> {
  try {
    await pb.health.check();
    return true;
  } catch {
    return false;
  }
}

// The data layer uses this flag to decide whether to use
// PocketBase or fall back to in-memory mock data.
let _usePocketBase = false;

export async function initDB(): Promise<boolean> {
  try {
    await pb.health.check();
    _usePocketBase = true;
    return true;
  } catch {
    console.warn("[DB] PocketBase not available, using in-memory data");
    _usePocketBase = false;
    return false;
  }
}

export function usePocketBase(): boolean {
  return _usePocketBase;
}