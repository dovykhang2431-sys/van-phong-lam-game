/* =========================================================================
 * Văn Phòng Làm Game v1.0 — Logic chính, đọc status.json trực tiếp (polling 5s),
 * cập nhật tại chỗ không vẽ lại toàn DOM, popup, đồng hồ, chế độ ngày/đêm
 * và vòng lặp chuyển động mượt 60fps
 * ========================================================================= */

(function () {
  'use strict';

  const VERSION = '1.2';
  const POLL_INTERVAL_MS = 5000;
  const HIGHLIGHT_DURATION_MS = 1750;
  const STATUS_API_URL = '/api/status';
  const STATUS_FILE_URL = './status.json';
  const API_FAIL_LIMIT = 2;
  const THEME_STORAGE_KEY = 'van_phong_lam_game_theme';

  const ROOM_INFO = {
    upper: {
      title: '👑 Tầng 2 — Phòng Giám Đốc',
      desc: 'Không gian điều hành ấm cúng với bàn giám đốc, ghế da, két sắt, kệ sách, bảng hiệu OFFICE, sofa tiếp khách, cây xanh và bể cá cảnh.'
    },
    lower: {
      title: '💻 Tầng 1 — Phòng Làm Việc Chung',
      desc: 'Khu làm việc của 5 thành viên chủ lực: Muse (kiểm tra), Gemini (lập trình 2 màn hình), Mochi (vẽ asset), Sora (nghiên cứu) và Antigravity (thợ xây).'
    }
  };

  const ROLE_EMOJIS = {
    khang: '👑',
    muse: '🔎',
    gemini: '💻',
    mochi: '🎨',
    sora: '📚',
    antigravity: '🔧'
  };

  const highlightTimers = new WeakMap();
  let syncTickTimer = null;

  const state = {
    data: { agents: [], jobs: [], activity: [] },
    selectedRoom: null,
    activeTab: 'jobs',
    toastTimer: null,
    rafId: null,
    zoomRafId: null,
    currentViewBox: [0, 0, 920, 845],
    officeRendered: false,
    hasLoadedOnce: false,
    isFetching: false,
    pollTimerId: null,
    lastUpdatedText: '',
    syncStatus: 'loading',
    dataSource: null, // 'api' (trực tiếp) | 'file' (dữ liệu tĩnh dự phòng)
    apiFailCount: 0,
    openModal: null,
    jobsSignatures: new Map(),
    activitySnapshot: ''
  };

  // Tham chiếu DOM
  const el = {
    versionBadge: document.getElementById('versionBadge'),
    clockTime: document.getElementById('clockTime'),
    btnFloorUpper: document.getElementById('btnFloorUpper'),
    btnFloorLower: document.getElementById('btnFloorLower'),
    btnThemeToggle: document.getElementById('btnThemeToggle'),
    themeIcon: document.getElementById('themeIcon'),
    themeLabel: document.getElementById('themeLabel'),
    btnReload: document.getElementById('btnReload'),
    officeCanvasWrap: document.getElementById('officeCanvasWrap'),
    roomCaption: document.getElementById('roomCaption'),
    roomCaptionTitle: document.getElementById('roomCaptionTitle'),
    roomCaptionDesc: document.getElementById('roomCaptionDesc'),
    roomCaptionMembers: document.getElementById('roomCaptionMembers'),
    btnCloseRoomCaption: document.getElementById('btnCloseRoomCaption'),
    liveSyncStatus: document.getElementById('liveSyncStatus'),
    liveSyncDot: document.getElementById('liveSyncDot'),
    liveSyncText: document.getElementById('liveSyncText'),
    liveSyncSource: document.getElementById('liveSyncSource'),
    tabJobs: document.getElementById('tabJobs'),
    tabActivity: document.getElementById('tabActivity'),
    sectionJobs: document.getElementById('sectionJobs'),
    sectionActivity: document.getElementById('sectionActivity'),
    jobsCount: document.getElementById('jobsCount'),
    activityCount: document.getElementById('activityCount'),
    jobsSummary: document.getElementById('jobsSummary'),
    activitySummary: document.getElementById('activitySummary'),
    jobsList: document.getElementById('jobsList'),
    activityList: document.getElementById('activityList'),
    modalBackdrop: document.getElementById('modalBackdrop'),
    modalAvatar: document.getElementById('modalAvatar'),
    modalTitle: document.getElementById('modalTitle'),
    modalSubtitle: document.getElementById('modalSubtitle'),
    modalBody: document.getElementById('modalBody'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    btnModalOk: document.getElementById('btnModalOk'),
    toast: document.getElementById('toast')
  };

  function escapeHTML(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTimeHMS(date) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.remove('hidden');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      el.toast.classList.add('hidden');
    }, 2200);
  }

  // Hiệu ứng làm nổi nhẹ ngắn hạn khi một chip hoặc một dòng vừa đổi trạng thái
  function triggerLiveHighlight(node) {
    if (!node) return;
    const prevTimer = highlightTimers.get(node);
    if (prevTimer) clearTimeout(prevTimer);

    node.classList.remove('live-updated');
    requestAnimationFrame(() => {
      node.classList.add('live-updated');
      const timer = setTimeout(() => {
        node.classList.remove('live-updated');
        highlightTimers.delete(node);
      }, HIGHLIGHT_DURATION_MS);
      highlightTimers.set(node, timer);
    });
  }

  // Cập nhật chỉ báo trực tiếp "Cập nhật lúc HH:MM:SS" / "đang thử lại"
  // source: 'api' = Trực tiếp (Vercel API), 'file' = Dữ liệu tĩnh (status.json)
  function setLiveSyncUI(mode, timeStr, source) {
    state.syncStatus = mode;
    if (source) state.dataSource = source;
    if (!el.liveSyncStatus || !el.liveSyncText) return;

    if (el.liveSyncSource) {
      el.liveSyncSource.textContent =
        state.dataSource === 'api'
          ? '· Trực tiếp'
          : state.dataSource === 'file'
            ? '· Dữ liệu tĩnh'
            : '';
    }

    if (mode === 'ok') {
      el.liveSyncStatus.classList.remove('is-retrying');
      el.liveSyncText.textContent = `Cập nhật lúc ${timeStr}`;
      if (el.liveSyncDot) {
        el.liveSyncDot.classList.remove('is-ticking');
        clearTimeout(syncTickTimer);
        requestAnimationFrame(() => {
          el.liveSyncDot.classList.add('is-ticking');
          syncTickTimer = setTimeout(() => {
            el.liveSyncDot.classList.remove('is-ticking');
          }, 700);
        });
      }
    } else if (mode === 'retrying') {
      el.liveSyncStatus.classList.add('is-retrying');
      el.liveSyncText.textContent = state.lastUpdatedText
        ? `Cập nhật lúc ${state.lastUpdatedText} · đang thử lại`
        : 'Đang thử lại...';
    }
  }

  // ===== Đồng hồ thời gian thực (chỉ cập nhật 1 text node, không vẽ lại DOM) =====
  function updateClock() {
    el.clockTime.textContent = formatTimeHMS(new Date());
  }

  // ===== Chế độ Ngày / Đêm =====
  function applyTheme(theme) {
    const mode = theme === 'night' ? 'night' : 'day';
    document.body.setAttribute('data-theme', mode);
    el.themeIcon.textContent = mode === 'night' ? '🌙' : '☀️';
    el.themeLabel.textContent = mode === 'night' ? 'Đêm' : 'Ngày';
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (_err) {
      // Bỏ qua nếu trình duyệt chặn storage
    }
  }

  function initTheme() {
    let saved = 'day';
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'night' || stored === 'day') saved = stored;
    } catch (_err) {
      saved = 'day';
    }
    applyTheme(saved);
  }

  // ===== Chuẩn hóa nhãn trạng thái công việc =====
  function getJobStatusMeta(status) {
    switch (status) {
      case 'doing':
        return { label: 'Đang làm', cls: 'doing' };
      case 'waiting':
        return { label: 'Chờ duyệt', cls: 'waiting' };
      case 'done':
        return { label: 'Hoàn thành', cls: 'job-done' };
      default:
        return { label: 'Đang làm', cls: 'doing' };
    }
  }

  function findAgentByNameOrId(key, agentsList) {
    if (!key) return null;
    const list = Array.isArray(agentsList) ? agentsList : state.data.agents;
    const lower = String(key).trim().toLowerCase();
    return (
      list.find(
        (a) => a.id.toLowerCase() === lower || a.name.toLowerCase() === lower
      ) || null
    );
  }

  // ===== Vẽ Văn Phòng SVG lần đầu và gắn sự kiện tương tác =====
  function renderOffice() {
    el.officeCanvasWrap.innerHTML = window.OfficeSVG.buildOfficeSVG(state.data.agents);

    // Sự kiện bấm vào nhân vật & chip trạng thái
    el.officeCanvasWrap.querySelectorAll('[data-agent-id]').forEach((node) => {
      const openHandler = (evt) => {
        evt.stopPropagation();
        const agentId = node.getAttribute('data-agent-id');
        const agent = findAgentByNameOrId(agentId);
        if (agent) openAgentModal(agent);
      };
      node.addEventListener('click', openHandler);
      node.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          openHandler(evt);
        }
      });
    });

    // Sự kiện bấm vào từng phòng (Tầng trên / Tầng dưới)
    el.officeCanvasWrap.querySelectorAll('[data-room]').forEach((roomNode) => {
      roomNode.addEventListener('click', () => {
        const roomId = roomNode.getAttribute('data-room');
        toggleRoomHighlight(roomId);
      });
    });

    state.officeRendered = true;
    applyRoomHighlightUI(true);
    startAmbientAnimation();
  }

  // ===== Cập nhật tại chỗ chip trạng thái & biểu cảm nhân vật (không vẽ lại toàn SVG) =====
  function patchOfficeInPlace(prevAgents, nextAgents) {
    const svg = el.officeCanvasWrap.querySelector('.office-svg');
    if (!svg) {
      renderOffice();
      return;
    }

    const prevMap = new Map();
    prevAgents.forEach((a) => prevMap.set(a.id, a));

    let membersMetaChanged = false;

    nextAgents.forEach((agent) => {
      const prev = prevMap.get(agent.id);
      const chipVisualChanged =
        !prev ||
        prev.status !== agent.status ||
        prev.name !== agent.name ||
        prev.color !== agent.color ||
        prev.floor !== agent.floor;

      const roleChanged = !prev || prev.role !== agent.role || prev.name !== agent.name;
      const stateOrTaskChanged =
        !prev ||
        prev.status !== agent.status ||
        prev.currentTask !== agent.currentTask ||
        prev.lastDone !== agent.lastDone;

      if (chipVisualChanged || roleChanged) {
        membersMetaChanged = true;
      }

      const chipNode = svg.querySelector(`[data-chip-id="${agent.id}"]`);
      if (chipNode) {
        // Agent "working" nhưng quá 15 phút không báo cáo: làm mờ chip
        chipNode.classList.toggle('stale-chip', Boolean(agent.stale));
        if (!prev || prev.stale !== agent.stale) {
          triggerLiveHighlight(chipNode);
        }
      }
      if (chipNode && chipVisualChanged) {
        window.OfficeSVG.updateStatusChip(chipNode, agent);
      }

      if (chipVisualChanged || roleChanged) {
        window.OfficeSVG.updateAgentCharacter(svg, agent);
      }

      if (chipNode && stateOrTaskChanged) {
        triggerLiveHighlight(chipNode);
      }
    });

    if (state.selectedRoom && membersMetaChanged) {
      renderRoomCaptionMembers();
    }
  }

  // ===== Phóng to mượt vào tầng được chọn (viewBox) =====
  function getTargetViewBox(roomId) {
    const boxes = (window.OfficeSVG && window.OfficeSVG.VIEWBOXES) || {
      all: [0, 0, 920, 845],
      upper: [68, 12, 784, 478],
      lower: [84, 434, 752, 386]
    };
    return (roomId && boxes[roomId]) ? boxes[roomId] : boxes.all;
  }

  function formatViewBox(box) {
    return box.map((n) => Number(n).toFixed(1)).join(' ');
  }

  function applyZoomViewBox(roomId, immediate) {
    const svg = el.officeCanvasWrap.querySelector('.office-svg');
    if (!svg) return;

    const target = getTargetViewBox(roomId);
    svg.classList.toggle('is-zoomed', Boolean(roomId));
    svg.setAttribute('data-zoom-floor', roomId || 'all');

    if (state.zoomRafId) {
      cancelAnimationFrame(state.zoomRafId);
      state.zoomRafId = null;
    }

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (immediate || reduceMotion) {
      state.currentViewBox = target.slice();
      svg.setAttribute('viewBox', formatViewBox(state.currentViewBox));
      return;
    }

    const start = state.currentViewBox.slice();
    const duration = 260;
    const t0 = performance.now();

    function step(now) {
      const p = Math.max(0, Math.min(1, (now - t0) / duration));
      const ease = 1 - Math.pow(1 - p, 3);
      state.currentViewBox = [
        start[0] + (target[0] - start[0]) * ease,
        start[1] + (target[1] - start[1]) * ease,
        start[2] + (target[2] - start[2]) * ease,
        start[3] + (target[3] - start[3]) * ease
      ];
      svg.setAttribute('viewBox', formatViewBox(state.currentViewBox));

      if (p < 1) {
        state.zoomRafId = requestAnimationFrame(step);
      } else {
        state.currentViewBox = target.slice();
        svg.setAttribute('viewBox', formatViewBox(state.currentViewBox));
        state.zoomRafId = null;
      }
    }

    state.zoomRafId = requestAnimationFrame(step);
  }

  // ===== Làm nổi, phóng to tầng & hiện chú thích =====
  function toggleRoomHighlight(roomId) {
    if (state.selectedRoom === roomId) {
      state.selectedRoom = null;
    } else {
      state.selectedRoom = roomId;
    }
    applyRoomHighlightUI(false);
  }

  function renderRoomCaptionMembers() {
    if (!state.selectedRoom) return;
    const floorAgents = state.data.agents.filter((a) => {
      const floor = a.floor || (a.id === 'khang' ? 'upper' : 'lower');
      return floor === state.selectedRoom;
    });

    el.roomCaptionMembers.innerHTML = floorAgents
      .map(
        (a) => `
          <button type="button" class="member-pill-btn" data-caption-agent="${escapeHTML(a.id)}">
            <span class="member-color-dot" style="background:${escapeHTML(a.color)}"></span>
            ${escapeHTML(a.name)} · ${escapeHTML(a.role)}
          </button>
        `
      )
      .join('');
  }

  function applyRoomHighlightUI(immediateZoom) {
    const roomUpper = document.getElementById('roomUpper');
    const roomLower = document.getElementById('roomLower');

    const isUpper = state.selectedRoom === 'upper';
    const isLower = state.selectedRoom === 'lower';

    el.btnFloorUpper.classList.toggle('active', isUpper);
    el.btnFloorUpper.setAttribute('aria-pressed', String(isUpper));
    el.btnFloorLower.classList.toggle('active', isLower);
    el.btnFloorLower.setAttribute('aria-pressed', String(isLower));

    if (roomUpper && roomLower) {
      roomUpper.classList.toggle('highlighted', isUpper);
      roomUpper.classList.toggle('dimmed', isLower);
      roomLower.classList.toggle('highlighted', isLower);
      roomLower.classList.toggle('dimmed', isUpper);
    }

    // Ẩn mờ chip của tầng không được chọn khi đang phóng to 1 tầng
    el.officeCanvasWrap.querySelectorAll('[data-chip-id]').forEach((chipNode) => {
      const chipFloor = chipNode.getAttribute('data-floor');
      const shouldDim = Boolean(state.selectedRoom && chipFloor && chipFloor !== state.selectedRoom);
      chipNode.classList.toggle('dimmed-chip', shouldDim);
    });

    applyZoomViewBox(state.selectedRoom, Boolean(immediateZoom));

    if (!state.selectedRoom) {
      el.roomCaption.classList.add('hidden');
      return;
    }

    const info = ROOM_INFO[state.selectedRoom];
    el.roomCaptionTitle.textContent = info.title;
    el.roomCaptionDesc.textContent = info.desc;

    renderRoomCaptionMembers();
    el.roomCaption.classList.remove('hidden');
  }

  // ===== Dựng & cập nhật tại chỗ Bảng Công Việc (chỉ sửa phần thay đổi) =====
  function buildJobElement(job, dotColor) {
    const meta = getJobStatusMeta(job.status);
    const li = document.createElement('li');
    li.setAttribute('data-job-item-id', String(job.id));

    li.innerHTML = `
      <button type="button" class="job-btn" data-job-id="${escapeHTML(job.id)}">
        <div class="job-top">
          <span class="job-title">${escapeHTML(job.title)}</span>
          <span class="status-pill ${meta.cls}">${escapeHTML(meta.label)}</span>
        </div>
        <div class="job-meta">
          <span class="job-owner">
            <span class="member-color-dot" style="background:${escapeHTML(dotColor)}"></span>
            <span class="job-owner-name">${escapeHTML(job.owner)}</span>
          </span>
          <span class="job-started">Bắt đầu: ${escapeHTML(job.startedAt || '--:--')}</span>
        </div>
      </button>
    `;
    return li;
  }

  function updateJobElementInPlace(li, job, dotColor) {
    const meta = getJobStatusMeta(job.status);
    const btn = li.querySelector('.job-btn');
    if (btn) btn.setAttribute('data-job-id', String(job.id));

    const titleEl = li.querySelector('.job-title');
    if (titleEl && titleEl.textContent !== String(job.title || '')) {
      titleEl.textContent = job.title || '';
    }

    const pillEl = li.querySelector('.status-pill');
    if (pillEl) {
      const nextCls = `status-pill ${meta.cls}`;
      if (pillEl.className !== nextCls) pillEl.className = nextCls;
      if (pillEl.textContent !== meta.label) pillEl.textContent = meta.label;
    }

    const dotEl = li.querySelector('.member-color-dot');
    if (dotEl) dotEl.style.background = dotColor;

    const ownerNameEl = li.querySelector('.job-owner-name');
    if (ownerNameEl && ownerNameEl.textContent !== String(job.owner || '')) {
      ownerNameEl.textContent = job.owner || '';
    }

    const startedEl = li.querySelector('.job-started');
    const startedText = `Bắt đầu: ${job.startedAt || '--:--'}`;
    if (startedEl && startedEl.textContent !== startedText) {
      startedEl.textContent = startedText;
    }
  }

  function renderJobsInPlace(isInitial) {
    const jobs = Array.isArray(state.data.jobs) ? state.data.jobs : [];
    const countText = String(jobs.length);
    if (el.jobsCount.textContent !== countText) {
      el.jobsCount.textContent = countText;
    }

    const doingCount = jobs.filter((j) => j.status === 'doing').length;
    const summaryText = `${doingCount} đang làm · ${jobs.length} tổng`;
    if (el.jobsSummary.textContent !== summaryText) {
      el.jobsSummary.textContent = summaryText;
    }

    if (jobs.length === 0) {
      if (!el.jobsList.querySelector('.empty-state') || el.jobsList.children.length !== 1) {
        el.jobsList.innerHTML = '<li class="empty-state">Chưa có công việc nào trong status.json.</li>';
      }
      state.jobsSignatures.clear();
      return;
    }

    // Xóa thông báo rỗng nếu trước đó đang hiện
    el.jobsList.querySelectorAll('.empty-state').forEach((n) => n.remove());

    const existingNodes = new Map();
    el.jobsList.querySelectorAll('li[data-job-item-id]').forEach((li) => {
      existingNodes.set(li.getAttribute('data-job-item-id'), li);
    });

    const nextSignatures = new Map();
    const keepIds = new Set();

    jobs.forEach((job, index) => {
      const id = String(job.id);
      keepIds.add(id);

      const ownerAgent = findAgentByNameOrId(job.owner);
      const dotColor = ownerAgent ? ownerAgent.color : '#94A3B8';
      const sig = JSON.stringify([
        job.title || '',
        job.owner || '',
        job.status || '',
        job.startedAt || '',
        job.description || '',
        dotColor
      ]);
      nextSignatures.set(id, sig);

      let li = existingNodes.get(id);
      const prevSig = state.jobsSignatures.get(id);

      if (!li) {
        li = buildJobElement(job, dotColor);
        const refNode = el.jobsList.children[index] || null;
        el.jobsList.insertBefore(li, refNode);
        if (!isInitial) {
          triggerLiveHighlight(li.querySelector('.job-btn'));
        }
      } else {
        if (prevSig !== sig) {
          updateJobElementInPlace(li, job, dotColor);
          if (!isInitial) {
            triggerLiveHighlight(li.querySelector('.job-btn'));
          }
        }
        // Đảm bảo đúng thứ tự mà không di chuyển nút đã đúng chỗ
        const currentAtPos = el.jobsList.children[index];
        if (currentAtPos !== li) {
          el.jobsList.insertBefore(li, currentAtPos || null);
        }
      }
    });

    existingNodes.forEach((li, id) => {
      if (!keepIds.has(id)) {
        li.remove();
      }
    });

    state.jobsSignatures = nextSignatures;
  }

  // ===== Dựng & cập nhật tại chỗ Nhật Ký Hoạt Động (mới nhất lên đầu, tối đa 20 dòng) =====
  function buildActivityElement(item, idx, key, accent) {
    const li = document.createElement('li');
    li.setAttribute('data-activity-key', key);
    li.innerHTML = `
      <button type="button" class="activity-btn" data-activity-idx="${idx}">
        <span class="activity-time">${escapeHTML(item.time || '--:--')}</span>
        <span class="activity-content">
          <span class="activity-agent" style="color:${escapeHTML(accent)}">${escapeHTML(item.agent)}</span>
          <span class="activity-text">${escapeHTML(item.text)}</span>
        </span>
      </button>
    `;
    return li;
  }

  function renderActivityInPlace(isInitial) {
    const raw = Array.isArray(state.data.activity) ? state.data.activity : [];
    const items = raw.slice(0, 20);

    const countText = String(items.length);
    if (el.activityCount.textContent !== countText) {
      el.activityCount.textContent = countText;
    }

    const summaryText = `${items.length} sự kiện gần nhất`;
    if (el.activitySummary.textContent !== summaryText) {
      el.activitySummary.textContent = summaryText;
    }

    if (items.length === 0) {
      if (!el.activityList.querySelector('.empty-state') || el.activityList.children.length !== 1) {
        el.activityList.innerHTML = '<li class="empty-state">Chưa có nhật ký hoạt động nào.</li>';
      }
      state.activitySnapshot = '[]';
      return;
    }

    const keyCounts = new Map();
    const enriched = items.map((item, idx) => {
      const agent = findAgentByNameOrId(item.agent);
      const accent = agent ? agent.color : '#64748B';
      const baseKey = `${item.time || ''}|${item.agent || ''}|${item.text || ''}`;
      const occ = (keyCounts.get(baseKey) || 0) + 1;
      keyCounts.set(baseKey, occ);
      const key = `${baseKey}#${occ}`;
      return { item, idx, key, accent };
    });

    const nextSnapshot = JSON.stringify(enriched.map((e) => [e.key, e.accent]));
    if (nextSnapshot === state.activitySnapshot && el.activityList.children.length === enriched.length) {
      return;
    }

    el.activityList.querySelectorAll('.empty-state').forEach((n) => n.remove());

    const existingNodes = new Map();
    el.activityList.querySelectorAll('li[data-activity-key]').forEach((li) => {
      existingNodes.set(li.getAttribute('data-activity-key'), li);
    });

    const keepKeys = new Set();

    enriched.forEach(({ item, idx, key, accent }) => {
      keepKeys.add(key);
      let li = existingNodes.get(key);

      if (!li) {
        li = buildActivityElement(item, idx, key, accent);
        const refNode = el.activityList.children[idx] || null;
        el.activityList.insertBefore(li, refNode);
        if (!isInitial) {
          triggerLiveHighlight(li.querySelector('.activity-btn'));
        }
      } else {
        const btn = li.querySelector('.activity-btn');
        if (btn) btn.setAttribute('data-activity-idx', String(idx));
        const agentEl = li.querySelector('.activity-agent');
        if (agentEl) agentEl.style.color = accent;

        const currentAtPos = el.activityList.children[idx];
        if (currentAtPos !== li) {
          el.activityList.insertBefore(li, currentAtPos || null);
        }
      }
    });

    existingNodes.forEach((li, key) => {
      if (!keepKeys.has(key)) {
        li.remove();
      }
    });

    state.activitySnapshot = nextSnapshot;
  }

  // ===== Popup Chi Tiết Nhân Vật =====
  function openAgentModal(agent, opts) {
    const keepFocus = Boolean(opts && opts.keepFocus);
    state.openModal = { type: 'agent', id: agent.id };

    const statusMeta = window.OfficeSVG.getStatusMeta(agent.status);
    const floorKey = agent.floor || (agent.id === 'khang' ? 'upper' : 'lower');
    const floorText = floorKey === 'upper' ? 'Tầng 2 — Phòng Giám Đốc' : 'Tầng 1 — Phòng Làm Việc Chung';

    el.modalAvatar.textContent = ROLE_EMOJIS[agent.id] || '🐱';
    el.modalAvatar.style.background = agent.color || '#F59E0B';
    el.modalTitle.textContent = agent.name;
    el.modalSubtitle.textContent = agent.role;

    const relatedJobs = state.data.jobs.filter(
      (j) => String(j.owner).toLowerCase() === String(agent.name).toLowerCase()
    );

    const relatedJobsHTML =
      relatedJobs.length > 0
        ? `
          <div class="info-block">
            <span class="info-label">Công việc phụ trách</span>
            <div class="modal-tags">
              ${relatedJobs
                .map(
                  (j) =>
                    `<button type="button" class="inline-link-btn" data-jump-job="${escapeHTML(j.id)}">📋 ${escapeHTML(j.title)}</button>`
                )
                .join('')}
            </div>
          </div>
        `
        : '';

    el.modalBody.innerHTML = `
      <div class="modal-tags">
        <span class="status-pill ${escapeHTML(agent.status || 'working')}">● ${escapeHTML(statusMeta.label)}</span>
        <span class="floor-tag">🏠 ${escapeHTML(floorText)}</span>
        ${agent.stale ? '<span class="stale-tag">⏱ chưa cập nhật</span>' : ''}
      </div>
      <div class="info-block">
        <span class="info-label">Việc đang làm</span>
        <div class="info-value">${escapeHTML(agent.currentTask || 'Hiện chưa có việc được giao.')}</div>
      </div>
      <div class="info-block">
        <span class="info-label">Việc vừa xong gần nhất</span>
        <div class="info-value">${escapeHTML(agent.lastDone || 'Chưa ghi nhận.')}</div>
      </div>
      ${relatedJobsHTML}
    `;

    el.modalBody.querySelectorAll('[data-jump-job]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const jobId = btn.getAttribute('data-jump-job');
        const job = state.data.jobs.find((j) => String(j.id) === String(jobId));
        if (job) openJobModal(job);
      });
    });

    el.modalBackdrop.classList.remove('hidden');
    if (!keepFocus) el.btnModalOk.focus();
  }

  // ===== Popup Chi Tiết Công Việc =====
  function openJobModal(job, opts) {
    const keepFocus = Boolean(opts && opts.keepFocus);
    state.openModal = { type: 'job', id: String(job.id) };

    const meta = getJobStatusMeta(job.status);
    const ownerAgent = findAgentByNameOrId(job.owner);

    el.modalAvatar.textContent = '📋';
    el.modalAvatar.style.background = ownerAgent ? ownerAgent.color : '#F59E0B';
    el.modalTitle.textContent = job.title;
    el.modalSubtitle.textContent = `Mã việc: ${job.id}`;

    const ownerButton = ownerAgent
      ? `<button type="button" class="inline-link-btn" id="btnJumpOwner">
           <span class="member-color-dot" style="background:${escapeHTML(ownerAgent.color)}"></span>
           ${escapeHTML(ownerAgent.name)} (${escapeHTML(ownerAgent.role)}) →
         </button>`
      : `<div class="info-value">${escapeHTML(job.owner)}</div>`;

    el.modalBody.innerHTML = `
      <div class="modal-tags">
        <span class="status-pill ${meta.cls}">● ${escapeHTML(meta.label)}</span>
        <span class="floor-tag">🕒 Bắt đầu lúc ${escapeHTML(job.startedAt || '--:--')}</span>
      </div>
      <div class="info-block">
        <span class="info-label">Người phụ trách</span>
        ${ownerButton}
      </div>
      <div class="info-block">
        <span class="info-label">Chi tiết công việc</span>
        <div class="info-value">${escapeHTML(job.description || 'Đang theo dõi tiến độ từ dữ liệu status.json.')}</div>
      </div>
    `;

    const jumpBtn = document.getElementById('btnJumpOwner');
    if (jumpBtn && ownerAgent) {
      jumpBtn.addEventListener('click', () => openAgentModal(ownerAgent));
    }

    el.modalBackdrop.classList.remove('hidden');
    if (!keepFocus) el.btnModalOk.focus();
  }

  function closeModal() {
    el.modalBackdrop.classList.add('hidden');
    state.openModal = null;
  }

  // Đồng bộ popup nếu người dùng đang mở popup đúng lúc dữ liệu đổi
  function syncOpenModalIfChanged(prevData) {
    if (!state.openModal || el.modalBackdrop.classList.contains('hidden')) return;

    if (state.openModal.type === 'agent') {
      const prevAgent = findAgentByNameOrId(state.openModal.id, prevData.agents);
      const nextAgent = findAgentByNameOrId(state.openModal.id, state.data.agents);
      if (nextAgent && JSON.stringify(prevAgent) !== JSON.stringify(nextAgent)) {
        openAgentModal(nextAgent, { keepFocus: true });
      }
    } else if (state.openModal.type === 'job') {
      const prevJob = prevData.jobs.find((j) => String(j.id) === state.openModal.id);
      const nextJob = state.data.jobs.find((j) => String(j.id) === state.openModal.id);
      if (nextJob && JSON.stringify(prevJob) !== JSON.stringify(nextJob)) {
        openJobModal(nextJob, { keepFocus: true });
      }
    }
  }

  // ===== Vòng lặp chuyển động mượt 60fps bằng requestAnimationFrame =====
  function startAmbientAnimation() {
    if (state.rafId) cancelAnimationFrame(state.rafId);

    const agentBodies = Array.from(document.querySelectorAll('.agent-anim-body'));
    const fish1 = document.getElementById('aquariumFish1');
    const fish2 = document.getElementById('aquariumFish2');
    const steam = document.querySelector('.steam-wisp');

    // Lấy vị trí gốc của cá từ thuộc tính transform ban đầu
    const parseTranslate = (node) => {
      if (!node) return null;
      const m = /translate\(([^,]+),\s*([^)]+)\)/.exec(node.getAttribute('transform') || '');
      return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
    };
    const fish1Base = parseTranslate(fish1);
    const fish2Base = parseTranslate(fish2);

    function tick(nowMs) {
      const t = nowMs * 0.001;

      // Nhịp thở / gõ máy nhẹ nhàng cho từng nhân vật (không vẽ lại DOM)
      agentBodies.forEach((node, idx) => {
        const status = node.getAttribute('data-status');
        const speed = status === 'working' ? 3.2 : status === 'done' ? 2.4 : 1.4;
        const amp = status === 'working' ? 1.8 : status === 'done' ? 2.2 : 1.0;
        const dy = Math.sin(t * speed + idx * 1.15) * amp;
        node.setAttribute('transform', `translate(0, ${dy.toFixed(2)})`);
      });

      // Cá bơi êm trong bể cá tầng 2
      if (fish1 && fish1Base) {
        const dx = Math.sin(t * 0.85) * 14;
        const dy = Math.cos(t * 1.7) * 2.2;
        const dir = Math.cos(t * 0.85) >= 0 ? 1 : -1;
        fish1.setAttribute(
          'transform',
          `translate(${(fish1Base.x + dx).toFixed(2)}, ${(fish1Base.y + dy).toFixed(2)}) scale(${dir}, 1)`
        );
      }

      if (fish2 && fish2Base) {
        const dx = Math.cos(t * 0.7 + 1.2) * 12;
        const dy = Math.sin(t * 1.4) * 2.0;
        const dir = -Math.sin(t * 0.7 + 1.2) >= 0 ? -1 : 1;
        fish2.setAttribute(
          'transform',
          `translate(${(fish2Base.x + dx).toFixed(2)}, ${(fish2Base.y + dy).toFixed(2)}) scale(${dir}, 1)`
        );
      }

      // Khói trà nhẹ bốc lên ở bàn tiếp khách tầng 2
      if (steam) {
        const phase = (t * 0.55) % 1;
        const yOff = -phase * 8;
        const op = Math.sin(phase * Math.PI) * 0.75;
        steam.setAttribute('transform', `translate(0, ${yOff.toFixed(2)})`);
        steam.setAttribute('opacity', op.toFixed(2));
      }

      state.rafId = requestAnimationFrame(tick);
    }

    state.rafId = requestAnimationFrame(tick);
  }

  // Áp dụng dữ liệu vừa tải vào trang (dùng chung cho API và file dự phòng)
  function applyStatusJson(json, isManualReload, source) {
    const prevData = state.data;
    const isInitial = !state.hasLoadedOnce;

    state.data = {
      agents: Array.isArray(json.agents) ? json.agents : [],
      jobs: Array.isArray(json.jobs) ? json.jobs : [],
      activity: Array.isArray(json.activity) ? json.activity : []
    };

    if (!state.officeRendered) {
      renderOffice();
    } else {
      patchOfficeInPlace(prevData.agents, state.data.agents);
    }

    renderJobsInPlace(isInitial);
    renderActivityInPlace(isInitial);
    syncOpenModalIfChanged(prevData);

    const nowStr = formatTimeHMS(new Date());
    state.lastUpdatedText = nowStr;
    state.hasLoadedOnce = true;
    setLiveSyncUI('ok', nowStr, source);

    if (isManualReload) {
      showToast(
        source === 'file'
          ? 'Đã cập nhật dữ liệu tĩnh từ status.json'
          : 'Đã cập nhật dữ liệu trực tiếp'
      );
    }
  }

  // ===== Đọc dữ liệu: ưu tiên API trực tiếp (/api/status), lỗi 2 lần liên
  // tiếp thì rơi về file status.json tĩnh; mất cả hai thì giữ dữ liệu cũ =====
  async function loadStatusData(isManualReload) {
    if (state.isFetching) return false;
    state.isFetching = true;

    try {
      const res = await fetch(`${STATUS_API_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      state.apiFailCount = 0;
      applyStatusJson(json, isManualReload, 'api');
      return true;
    } catch (apiErr) {
      state.apiFailCount += 1;

      // Chưa đủ 2 lần lỗi liên tiếp: chờ lần poll sau thử lại API, chưa vội rơi về file
      if (state.apiFailCount < API_FAIL_LIMIT) {
        setLiveSyncUI('retrying');
        if (!state.hasLoadedOnce) {
          if (!state.officeRendered) {
            renderOffice();
          }
          el.jobsSummary.textContent = 'Đang thử lại...';
          el.jobsList.innerHTML = '<li class="empty-state">Đang kết nối tới API trực tiếp, đang thử lại...</li>';
          el.activityList.innerHTML = '<li class="empty-state">Đang thử lại lấy nhật ký hoạt động...</li>';
        } else if (isManualReload) {
          showToast('Mất kết nối API — giữ dữ liệu cũ, đang thử lại');
        }
        return false;
      }

      // API lỗi 2 lần liên tiếp: đọc file status.json tĩnh làm dự phòng
      try {
        const res = await fetch(`${STATUS_FILE_URL}?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        applyStatusJson(json, isManualReload, 'file');
        return true;
      } catch (_fileErr) {
        // Mất mạng / lỗi tạm thời: giữ nguyên dữ liệu cũ, hiện trạng thái "đang thử lại", không làm trang trắng
        setLiveSyncUI('retrying');
        if (!state.hasLoadedOnce) {
          if (!state.officeRendered) {
            renderOffice();
          }
          el.jobsSummary.textContent = 'Đang thử lại...';
          el.jobsList.innerHTML = '<li class="empty-state">Đang kết nối tới status.json, đang thử lại...</li>';
          el.activityList.innerHTML = '<li class="empty-state">Đang thử lại lấy nhật ký hoạt động...</li>';
        } else if (isManualReload) {
          showToast('Mất kết nối — giữ dữ liệu cũ, đang thử lại');
        }
        return false;
      }
    } finally {
      state.isFetching = false;
    }
  }

  function startLivePolling() {
    if (state.pollTimerId) clearInterval(state.pollTimerId);
    state.pollTimerId = setInterval(() => {
      // Tab đang ẩn: bỏ qua lượt poll để đỡ tốn hạn mức API, mở lại tab sẽ tải ngay (visibilitychange)
      if (document.hidden) return;
      loadStatusData(false);
    }, POLL_INTERVAL_MS);
  }

  // ===== Tab chuyển bảng trên màn hình nhỏ =====
  function switchSideTab(tabName) {
    state.activeTab = tabName;
    const isJobs = tabName === 'jobs';

    el.tabJobs.classList.toggle('active', isJobs);
    el.tabJobs.setAttribute('aria-selected', String(isJobs));
    el.sectionJobs.classList.toggle('active', isJobs);

    el.tabActivity.classList.toggle('active', !isJobs);
    el.tabActivity.setAttribute('aria-selected', String(!isJobs));
    el.sectionActivity.classList.toggle('active', !isJobs);
  }

  // ===== Đăng ký Service Worker PWA =====
  function registerServiceWorker() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('Đăng ký Service Worker không thành công:', err);
      });
    }
  }

  // ===== Khởi tạo =====
  function init() {
    el.versionBadge.textContent = `v${VERSION}`;
    document.title = `Văn Phòng Làm Game v${VERSION}`;

    initTheme();
    updateClock();
    setInterval(updateClock, 1000);

    // Ủy quyền sự kiện cho danh sách công việc, nhật ký & thành viên phòng (không cần gắn lại khi polling)
    el.jobsList.addEventListener('click', (evt) => {
      const btn = evt.target.closest('[data-job-id]');
      if (!btn) return;
      const jobId = btn.getAttribute('data-job-id');
      const job = state.data.jobs.find((j) => String(j.id) === String(jobId));
      if (job) openJobModal(job);
    });

    el.activityList.addEventListener('click', (evt) => {
      const btn = evt.target.closest('[data-activity-idx]');
      if (!btn) return;
      const idx = Number(btn.getAttribute('data-activity-idx'));
      const entry = state.data.activity[idx];
      if (!entry) return;
      const agent = findAgentByNameOrId(entry.agent);
      if (agent) {
        openAgentModal(agent);
      } else {
        showToast(`${entry.time} · ${entry.agent}: ${entry.text}`);
      }
    });

    el.roomCaptionMembers.addEventListener('click', (evt) => {
      const btn = evt.target.closest('[data-caption-agent]');
      if (!btn) return;
      const agent = findAgentByNameOrId(btn.getAttribute('data-caption-agent'));
      if (agent) openAgentModal(agent);
    });

    // Gắn sự kiện cho mọi nút trên màn hình (không nút chết)
    el.btnFloorUpper.addEventListener('click', () => toggleRoomHighlight('upper'));
    el.btnFloorLower.addEventListener('click', () => toggleRoomHighlight('lower'));
    el.btnCloseRoomCaption.addEventListener('click', () => {
      state.selectedRoom = null;
      applyRoomHighlightUI(false);
    });

    el.btnThemeToggle.addEventListener('click', () => {
      const next = document.body.getAttribute('data-theme') === 'night' ? 'day' : 'night';
      applyTheme(next);
      showToast(next === 'night' ? 'Đã chuyển sang chế độ Đêm 🌙' : 'Đã chuyển sang chế độ Ngày ☀️');
    });

    el.btnReload.addEventListener('click', () => loadStatusData(true));

    el.tabJobs.addEventListener('click', () => switchSideTab('jobs'));
    el.tabActivity.addEventListener('click', () => switchSideTab('activity'));

    el.btnCloseModal.addEventListener('click', closeModal);
    el.btnModalOk.addEventListener('click', closeModal);
    el.modalBackdrop.addEventListener('click', (evt) => {
      if (evt.target === el.modalBackdrop) closeModal();
    });
    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape') {
        if (!el.modalBackdrop.classList.contains('hidden')) {
          closeModal();
        } else if (state.selectedRoom) {
          state.selectedRoom = null;
          applyRoomHighlightUI(false);
        }
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state.hasLoadedOnce) {
        loadStatusData(false);
      }
    });

    // Xuất API nhỏ giúp tự kiểm thử trạng thái thực
    window.VanPhongGame = {
      VERSION: VERSION,
      POLL_INTERVAL_MS: POLL_INTERVAL_MS,
      getState: () => state.data,
      getSelectedRoom: () => state.selectedRoom,
      getLastUpdated: () => state.lastUpdatedText,
      getSyncStatus: () => state.syncStatus,
      getDataSource: () => state.dataSource,
      reload: () => loadStatusData(false),
      highlightRoom: (roomId) => toggleRoomHighlight(roomId)
    };

    loadStatusData(false);
    startLivePolling();
    registerServiceWorker();
  }

  init();
})();
