/* =========================================================================
 * Văn Phòng Làm Game v1.0 — Logic chính, đọc status.json, popup, đồng hồ,
 * chế độ ngày/đêm và vòng lặp chuyển động mượt 60fps
 * ========================================================================= */

(function () {
  'use strict';

  const VERSION = '1.0';
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

  const state = {
    data: { agents: [], jobs: [], activity: [] },
    selectedRoom: null,
    activeTab: 'jobs',
    toastTimer: null,
    rafId: null,
    zoomRafId: null,
    currentViewBox: [0, 0, 920, 845]
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

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.remove('hidden');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      el.toast.classList.add('hidden');
    }, 2200);
  }

  // ===== Đồng hồ thời gian thực (chỉ cập nhật 1 text node, không vẽ lại DOM) =====
  function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    el.clockTime.textContent = `${hh}:${mm}:${ss}`;
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

  function findAgentByNameOrId(key) {
    if (!key) return null;
    const lower = String(key).trim().toLowerCase();
    return (
      state.data.agents.find(
        (a) => a.id.toLowerCase() === lower || a.name.toLowerCase() === lower
      ) || null
    );
  }

  // ===== Vẽ Văn Phòng SVG và gắn sự kiện tương tác =====
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

    applyRoomHighlightUI(true);
    startAmbientAnimation();
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
      const p = Math.min(1, (now - t0) / duration);
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

    el.roomCaptionMembers.querySelectorAll('[data-caption-agent]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const agent = findAgentByNameOrId(btn.getAttribute('data-caption-agent'));
        if (agent) openAgentModal(agent);
      });
    });

    el.roomCaption.classList.remove('hidden');
  }

  // ===== Dựng Bảng Công Việc =====
  function renderJobs() {
    const jobs = Array.isArray(state.data.jobs) ? state.data.jobs : [];
    el.jobsCount.textContent = String(jobs.length);

    const doingCount = jobs.filter((j) => j.status === 'doing').length;
    el.jobsSummary.textContent = `${doingCount} đang làm · ${jobs.length} tổng`;

    if (jobs.length === 0) {
      el.jobsList.innerHTML = '<li class="empty-state">Chưa có công việc nào trong status.json.</li>';
      return;
    }

    el.jobsList.innerHTML = jobs
      .map((job) => {
        const meta = getJobStatusMeta(job.status);
        const ownerAgent = findAgentByNameOrId(job.owner);
        const dotColor = ownerAgent ? ownerAgent.color : '#94A3B8';
        return `
          <li>
            <button type="button" class="job-btn" data-job-id="${escapeHTML(job.id)}">
              <div class="job-top">
                <span class="job-title">${escapeHTML(job.title)}</span>
                <span class="status-pill ${meta.cls}">${escapeHTML(meta.label)}</span>
              </div>
              <div class="job-meta">
                <span class="job-owner">
                  <span class="member-color-dot" style="background:${escapeHTML(dotColor)}"></span>
                  ${escapeHTML(job.owner)}
                </span>
                <span>Bắt đầu: ${escapeHTML(job.startedAt || '--:--')}</span>
              </div>
            </button>
          </li>
        `;
      })
      .join('');

    el.jobsList.querySelectorAll('[data-job-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const jobId = btn.getAttribute('data-job-id');
        const job = jobs.find((j) => String(j.id) === String(jobId));
        if (job) openJobModal(job);
      });
    });
  }

  // ===== Dựng Nhật Ký Hoạt Động (mới nhất lên đầu, tối đa 20 dòng) =====
  function renderActivity() {
    const raw = Array.isArray(state.data.activity) ? state.data.activity : [];
    const items = raw.slice(0, 20);
    el.activityCount.textContent = String(items.length);
    el.activitySummary.textContent = `${items.length} sự kiện gần nhất`;

    if (items.length === 0) {
      el.activityList.innerHTML = '<li class="empty-state">Chưa có nhật ký hoạt động nào.</li>';
      return;
    }

    el.activityList.innerHTML = items
      .map((item, idx) => {
        const agent = findAgentByNameOrId(item.agent);
        const accent = agent ? agent.color : '#64748B';
        return `
          <li>
            <button type="button" class="activity-btn" data-activity-idx="${idx}">
              <span class="activity-time">${escapeHTML(item.time || '--:--')}</span>
              <span class="activity-content">
                <span class="activity-agent" style="color:${escapeHTML(accent)}">${escapeHTML(item.agent)}</span>
                <span>${escapeHTML(item.text)}</span>
              </span>
            </button>
          </li>
        `;
      })
      .join('');

    el.activityList.querySelectorAll('[data-activity-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-activity-idx'));
        const entry = items[idx];
        if (!entry) return;
        const agent = findAgentByNameOrId(entry.agent);
        if (agent) {
          openAgentModal(agent);
        } else {
          showToast(`${entry.time} · ${entry.agent}: ${entry.text}`);
        }
      });
    });
  }

  // ===== Popup Chi Tiết Nhân Vật =====
  function openAgentModal(agent) {
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
    el.btnModalOk.focus();
  }

  // ===== Popup Chi Tiết Công Việc =====
  function openJobModal(job) {
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
    el.btnModalOk.focus();
  }

  function closeModal() {
    el.modalBackdrop.classList.add('hidden');
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

  // ===== Đọc dữ liệu từ status.json =====
  async function loadStatusData(isManualReload) {
    try {
      const url = `./status.json?t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      state.data = {
        agents: Array.isArray(json.agents) ? json.agents : [],
        jobs: Array.isArray(json.jobs) ? json.jobs : [],
        activity: Array.isArray(json.activity) ? json.activity : []
      };

      renderOffice();
      renderJobs();
      renderActivity();

      if (isManualReload) {
        showToast('Đã cập nhật dữ liệu mới từ status.json');
      }
    } catch (err) {
      console.error('Không thể tải status.json:', err);
      el.jobsList.innerHTML = '<li class="empty-state">Lỗi tải status.json. Hãy mở qua HTTP server.</li>';
      el.activityList.innerHTML = '<li class="empty-state">Không thể đọc nhật ký hoạt động.</li>';
      showToast('Lỗi đọc status.json');
    }
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

    // Gắn sự kiện cho mọi nút trên màn hình (không nút chết)
    el.btnFloorUpper.addEventListener('click', () => toggleRoomHighlight('upper'));
    el.btnFloorLower.addEventListener('click', () => toggleRoomHighlight('lower'));
    el.btnCloseRoomCaption.addEventListener('click', () => {
      state.selectedRoom = null;
      applyRoomHighlightUI();
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

    // Xuất API nhỏ giúp tự kiểm thử trạng thái thực
    window.VanPhongGame = {
      VERSION: VERSION,
      getState: () => state.data,
      getSelectedRoom: () => state.selectedRoom,
      reload: () => loadStatusData(false),
      highlightRoom: (roomId) => toggleRoomHighlight(roomId)
    };

    loadStatusData(false);
    registerServiceWorker();
  }

  init();
})();
