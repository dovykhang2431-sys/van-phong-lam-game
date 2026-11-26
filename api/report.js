'use strict';
/**
 * POST /api/report — token required (header x-office-token must equal
 * env OFFICE_WRITE_TOKEN). Report types (see design doc §5.2):
 *   agent       — {agent, status: working|idle, currentTask?, lastDone?}
 *   agent-idle  — {agent, lastDone?}
 *   job-start   — {job:{title, owner, description?}} -> {ok, jobId}
 *   job-finish  — {jobId, note?}
 *   activity    — {agent, text}
 *   seed        — {data:{agents, jobs, activity}} (one-time deploy seed;
 *                  overwrites all keys, keeps the exact ids from status.json)
 * Validation: known agent ids only, text/title <= 200 chars, body <= 10 KB.
 * Errors: 401 bad/missing token, 400 bad input, 405 wrong method.
 */
const fs = require('fs');
const path = require('path');
const { getStore, AGENT_IDS } = require('../lib/store');

const MAX_BODY_BYTES = 10 * 1024;
const MAX_TEXT_LEN = 200;

function nowHHMM() {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date());
}

function bad(res, status, error) {
  return res.status(status).json({ ok: false, error });
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isValidText(v) {
  return typeof v === 'string' && v.length <= MAX_TEXT_LEN;
}

function loadSeed() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'status.json'), 'utf8');
    return JSON.parse(raw);
  } catch (_e) {
    return { agents: [], jobs: [], activity: [] };
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const token = req.headers['x-office-token'];
  if (!process.env.OFFICE_WRITE_TOKEN || token !== process.env.OFFICE_WRITE_TOKEN) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return bad(res, 400, 'bad_body');
  }
  if (JSON.stringify(body).length > MAX_BODY_BYTES) {
    return bad(res, 400, 'body_too_large');
  }

  try {
    const store = getStore();
    const seed = loadSeed();
    const type = body.type;

    if (type === 'agent') {
      if (!AGENT_IDS.includes(body.agent)) return bad(res, 400, 'unknown_agent');
      if (body.status !== 'working' && body.status !== 'idle') return bad(res, 400, 'bad_status');
      if (body.currentTask !== undefined && !isValidText(body.currentTask)) return bad(res, 400, 'bad_text');
      if (body.lastDone !== undefined && !isValidText(body.lastDone)) return bad(res, 400, 'bad_text');
      let agent = await store.getAgent(body.agent);
      if (!agent) agent = (seed.agents || []).find((a) => a.id === body.agent) || { id: body.agent };
      agent.status = body.status;
      if (body.currentTask !== undefined) agent.currentTask = body.currentTask;
      if (body.lastDone !== undefined) agent.lastDone = body.lastDone;
      agent.reportedAt = new Date().toISOString();
      await store.setAgent(body.agent, agent);
      return res.status(200).json({ ok: true });
    }

    if (type === 'agent-idle') {
      if (!AGENT_IDS.includes(body.agent)) return bad(res, 400, 'unknown_agent');
      if (body.lastDone !== undefined && !isValidText(body.lastDone)) return bad(res, 400, 'bad_text');
      let agent = await store.getAgent(body.agent);
      if (!agent) agent = (seed.agents || []).find((a) => a.id === body.agent) || { id: body.agent };
      agent.status = 'idle';
      agent.currentTask = '';
      if (body.lastDone !== undefined) agent.lastDone = body.lastDone;
      agent.reportedAt = new Date().toISOString();
      await store.setAgent(body.agent, agent);
      return res.status(200).json({ ok: true });
    }

    if (type === 'job-start') {
      const job = body.job || {};
      if (!isNonEmptyString(job.title) || !isValidText(job.title)) return bad(res, 400, 'bad_title');
      if (!isNonEmptyString(job.owner)) return bad(res, 400, 'bad_owner');
      if (job.description !== undefined && !isValidText(job.description)) return bad(res, 400, 'bad_text');
      let jobs = (await store.getJobs()) || seed.jobs || [];
      const newJob = {
        id: `job-${Date.now()}`,
        title: job.title.trim(),
        owner: job.owner.trim(),
        status: 'doing',
        startedAt: nowHHMM(),
        description: job.description ? job.description.trim() : '',
      };
      jobs = [newJob, ...jobs];
      await store.setJobs(jobs);
      await store.pushActivity({ time: nowHHMM(), agent: newJob.owner, text: `Bắt đầu ${newJob.title}` });
      return res.status(200).json({ ok: true, jobId: newJob.id });
    }

    if (type === 'job-finish') {
      if (!isNonEmptyString(body.jobId)) return bad(res, 400, 'bad_job_id');
      let jobs = (await store.getJobs()) || seed.jobs || [];
      const idx = jobs.findIndex((j) => String(j.id) === String(body.jobId));
      if (idx < 0) return bad(res, 400, 'unknown_job');
      const job = { ...jobs[idx], status: 'done' };
      if (isValidText(body.note) && body.note.trim()) {
        job.description = job.description
          ? `${job.description} — ${body.note.trim()}`
          : body.note.trim();
      }
      jobs[idx] = job;
      await store.setJobs(jobs);
      await store.pushActivity({ time: nowHHMM(), agent: job.owner, text: `Xong ${job.title}` });
      return res.status(200).json({ ok: true });
    }

    if (type === 'activity') {
      if (!AGENT_IDS.includes(body.agent)) return bad(res, 400, 'unknown_agent');
      if (!isNonEmptyString(body.text) || !isValidText(body.text)) return bad(res, 400, 'bad_text');
      const seedAgent = (seed.agents || []).find((a) => a.id === body.agent);
      const displayName = seedAgent ? seedAgent.name : body.agent;
      await store.pushActivity({ time: nowHHMM(), agent: displayName, text: body.text.trim() });
      return res.status(200).json({ ok: true });
    }

    if (type === 'seed') {
      const data = body.data || {};
      if (!Array.isArray(data.agents) || !Array.isArray(data.jobs) || !Array.isArray(data.activity)) {
        return bad(res, 400, 'bad_seed');
      }
      for (const a of data.agents) {
        if (!a || !AGENT_IDS.includes(a.id)) return bad(res, 400, 'unknown_agent');
      }
      for (const j of data.jobs) {
        if (!j || !isNonEmptyString(j.id) || !isNonEmptyString(j.title)) return bad(res, 400, 'bad_seed');
      }
      for (const item of data.activity) {
        if (!item || !isNonEmptyString(item.time) || !isNonEmptyString(item.agent) || !isValidText(item.text || '')) {
          return bad(res, 400, 'bad_seed');
        }
      }
      const now = new Date().toISOString();
      for (const a of data.agents) {
        await store.setAgent(a.id, { ...a, reportedAt: now });
      }
      await store.setJobs(data.jobs.map((j) => ({ ...j })));
      await store.clearActivity();
      // Seed file lists activity newest-first; push in reverse so the
      // stored order matches the file.
      for (const item of [...data.activity].reverse()) {
        await store.pushActivity({ ...item });
      }
      return res.status(200).json({ ok: true });
    }

    return bad(res, 400, 'unknown_type');
  } catch (_err) {
    return res.status(500).json({ ok: false, error: 'store_error' });
  }
};
