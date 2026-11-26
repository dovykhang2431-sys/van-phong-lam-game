'use strict';
/**
 * Store abstraction for office status data.
 *
 * Production (Vercel): Upstash Redis via the env vars injected by the
 * Marketplace integration. The integration's current names are
 * KV_REST_API_URL / KV_REST_API_TOKEN (older docs use
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) — accept both.
 * Local dev / tests: in-memory store — only when NOT running on Vercel.
 * On Vercel without the Upstash env vars we throw instead of silently
 * using memory (data would be lost between invocations).
 */

const AGENT_IDS = ['khang', 'muse', 'gemini', 'mochi', 'sora', 'antigravity'];

let memoryStore = null;

function createMemoryStore() {
  const agents = new Map(); // id -> object
  let jobs = null; // array or null (null = not written yet)
  const activity = []; // newest first, max 50

  return {
    kind: 'memory',
    async getAgent(id) {
      return agents.has(id) ? { ...agents.get(id) } : null;
    },
    async setAgent(id, obj) {
      agents.set(id, { ...obj });
    },
    async getJobs() {
      return jobs ? jobs.map((j) => ({ ...j })) : null;
    },
    async setJobs(arr) {
      jobs = arr.map((j) => ({ ...j }));
    },
    async getActivity() {
      return activity.map((a) => ({ ...a }));
    },
    async pushActivity(item) {
      activity.unshift({ ...item });
      if (activity.length > 50) activity.length = 50;
    },
    async clearActivity() {
      activity.length = 0;
    },
  };
}

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

function createRedisStore() {
  // Lazy require: local dev/tests never load @upstash/redis.
  const { Redis } = require('@upstash/redis');
  const cfg = redisConfig();
  const redis = new Redis(cfg);

  const parse = (v) => (v == null ? null : typeof v === 'string' ? JSON.parse(v) : v);

  return {
    kind: 'redis',
    async getAgent(id) {
      return parse(await redis.get(`office:agent:${id}`));
    },
    async setAgent(id, obj) {
      await redis.set(`office:agent:${id}`, JSON.stringify(obj));
    },
    async getJobs() {
      return parse(await redis.get('office:jobs'));
    },
    async setJobs(arr) {
      await redis.set('office:jobs', JSON.stringify(arr));
    },
    async getActivity() {
      const items = await redis.lrange('office:activity', 0, 49);
      return items.map((x) => (typeof x === 'string' ? JSON.parse(x) : x));
    },
    async pushActivity(item) {
      await redis.lpush('office:activity', JSON.stringify(item));
      await redis.ltrim('office:activity', 0, 49);
    },
    async clearActivity() {
      await redis.del('office:activity');
    },
  };
}

function getStore() {
  if (redisConfig()) {
    return createRedisStore();
  }
  if (process.env.VERCEL) {
    throw new Error('Upstash Redis env vars missing on Vercel');
  }
  if (!memoryStore) memoryStore = createMemoryStore();
  return memoryStore;
}

module.exports = { getStore, AGENT_IDS };
