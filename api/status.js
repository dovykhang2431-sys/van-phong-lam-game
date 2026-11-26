'use strict';
/**
 * GET /api/status — public, no token.
 * Returns the exact status.json shape:
 *   { updatedAt, officeName, agents, jobs, activity }
 * plus `stale: true` on any agent that is `working` but has not reported
 * for over 15 minutes. Any key missing from Redis falls back to the
 * bundled status.json (seed / fallback data).
 */
const fs = require('fs');
const path = require('path');
const { getStore, AGENT_IDS } = require('../lib/store');

const STALE_MS = 15 * 60 * 1000;

function loadSeed() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'status.json'), 'utf8');
    return JSON.parse(raw);
  } catch (_e) {
    return { updatedAt: null, officeName: 'Văn Phòng Làm Game', agents: [], jobs: [], activity: [] };
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');
  try {
    const store = getStore();
    const seed = loadSeed();

    const agents = [];
    let latestReportedAt = null;
    for (const id of AGENT_IDS) {
      let agent = await store.getAgent(id);
      if (!agent) {
        agent = (seed.agents || []).find((a) => a.id === id) || null;
      }
      if (!agent) continue;
      const out = { ...agent };
      if (out.reportedAt) {
        const t = Date.parse(out.reportedAt);
        if (!Number.isNaN(t)) {
          if (!latestReportedAt || t > Date.parse(latestReportedAt)) latestReportedAt = out.reportedAt;
          if (out.status === 'working' && Date.now() - t > STALE_MS) out.stale = true;
        }
      }
      agents.push(out);
    }

    let jobs = await store.getJobs();
    if (!jobs) jobs = seed.jobs || [];

    let activity = await store.getActivity();
    if (!activity || activity.length === 0) activity = seed.activity || [];

    return res.status(200).json({
      updatedAt: latestReportedAt || seed.updatedAt || null,
      officeName: seed.officeName || 'Văn Phòng Làm Game',
      agents,
      jobs,
      activity,
    });
  } catch (_err) {
    return res.status(500).json({ ok: false, error: 'store_error' });
  }
};
