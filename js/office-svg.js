/* =========================================================================
 * Văn Phòng Làm Game v1.0 — Dựng mô hình SVG 2 tầng phong cách dollhouse
 * Lấy cảm hứng từ văn phòng mèo 2 tầng isometric pastel ấm áp
 * ========================================================================= */

(function (global) {
  'use strict';

  const CX = 460;
  const W = 365;

  // Tầng 2 (Phòng Giám Đốc)
  const CY2 = 310;
  const H2 = 152;
  const WALL2 = 132;

  // Tầng 1 (Phòng Làm Việc Chung)
  const CY1 = 635;
  const H1 = 158;

  const INK = '#3B2F2F';

  // Khung viewBox cho chế độ xem toàn cảnh và phóng to từng tầng
  const VIEWBOXES = {
    all: [0, 0, 920, 845],
    upper: [68, 12, 784, 478],
    lower: [84, 434, 752, 386]
  };

  // Chuyển đổi tọa độ isometric (u, v) ∈ [0..1] sang pixel (x, y)
  function iso2(u, v) {
    return {
      x: CX + (u - v) * W,
      y: (CY2 - H2) + (u + v) * H2
    };
  }

  function iso1(u, v) {
    return {
      x: CX + (u - v) * W,
      y: (CY1 - H1) + (u + v) * H1
    };
  }

  function pts(arr) {
    return arr.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  // Vẽ khối hộp isometric 3D đặt trên sàn (u0..u1, v0..v1, chiều cao z)
  function isoBox(isoFn, u0, v0, u1, v1, z, topFill, leftFill, rightFill, strokeW = 2.2) {
    const p00 = isoFn(u0, v0);
    const p10 = isoFn(u1, v0);
    const p11 = isoFn(u1, v1);
    const p01 = isoFn(u0, v1);

    const t00 = { x: p00.x, y: p00.y - z };
    const t10 = { x: p10.x, y: p10.y - z };
    const t11 = { x: p11.x, y: p11.y - z };
    const t01 = { x: p01.x, y: p01.y - z };

    return `
      <polygon points="${pts([t01, t11, p11, p01])}" fill="${leftFill}" stroke="${INK}" stroke-width="${strokeW}" stroke-linejoin="round"/>
      <polygon points="${pts([t10, t11, p11, p10])}" fill="${rightFill}" stroke="${INK}" stroke-width="${strokeW}" stroke-linejoin="round"/>
      <polygon points="${pts([t00, t10, t11, t01])}" fill="${topFill}" stroke="${INK}" stroke-width="${strokeW}" stroke-linejoin="round"/>
    `;
  }

  // Nhãn trạng thái tiếng Việt + màu sắc
  function getStatusMeta(status) {
    switch (status) {
      case 'working':
        return { label: 'Đang làm', fill: '#16A34A', bg: '#DCFCE7', stroke: '#15803D' };
      case 'idle':
        return { label: 'Rảnh', fill: '#64748B', bg: '#F1F5F9', stroke: '#475569' };
      case 'waiting':
        return { label: 'Chờ duyệt', fill: '#CA8A04', bg: '#FEF3C7', stroke: '#A16207' };
      case 'done':
        return { label: 'Xong việc', fill: '#D97706', bg: '#FEF3C7', stroke: '#B45309' };
      default:
        return { label: 'Đang làm', fill: '#16A34A', bg: '#DCFCE7', stroke: '#15803D' };
    }
  }

  // Vẽ nhân vật chibi mèo tròn trịa đáng yêu (mỗi người màu & phụ kiện riêng)
  function renderChibiCharacter(agent, x, y, scale = 1) {
    const id = agent.id;
    const color = agent.color || '#F59E0B';

    // Phụ kiện đặc trưng cho từng vai trò
    let accessory = '';
    let faceExtra = '';

    if (id === 'khang') {
      // Giám đốc: kính tròn + cà vạt xanh navy
      faceExtra = `
        <circle cx="-6" cy="-21" r="4.2" fill="rgba(255,255,255,0.45)" stroke="${INK}" stroke-width="1.8"/>
        <circle cx="6" cy="-21" r="4.2" fill="rgba(255,255,255,0.45)" stroke="${INK}" stroke-width="1.8"/>
        <line x1="-1.8" y1="-21" x2="1.8" y2="-21" stroke="${INK}" stroke-width="1.8"/>
        <polygon points="0,-10 -3.5,-2 0,3 3.5,-2" fill="#2563EB" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
      `;
    } else if (id === 'muse') {
      // Quản lý & Kiểm tra: nơ/huy hiệu sao xanh + kính kiểm tra nhỏ trên trán
      accessory = `
        <path d="M-9,-34 Q0,-40 9,-34 L7,-30 Q0,-33 -7,-30 Z" fill="#1D4ED8" stroke="${INK}" stroke-width="1.8"/>
        <circle cx="0" cy="-34" r="2.8" fill="#FDE047" stroke="${INK}" stroke-width="1.3"/>
      `;
    } else if (id === 'gemini') {
      // Lập trình chính: tai nghe chụp đầu dev cực ngầu
      accessory = `
        <path d="M-16,-22 C-17,-39 17,-39 16,-22" fill="none" stroke="#4C1D95" stroke-width="3.6" stroke-linecap="round"/>
        <rect x="-20" y="-27" width="6" height="11" rx="3" fill="#DDD6FE" stroke="${INK}" stroke-width="1.8"/>
        <rect x="14" y="-27" width="6" height="11" rx="3" fill="#DDD6FE" stroke="${INK}" stroke-width="1.8"/>
      `;
    } else if (id === 'mochi') {
      // Họa sĩ asset: mũ nồi họa sĩ màu hồng đậm
      accessory = `
        <ellipse cx="2" cy="-35" rx="13" ry="6" fill="#DB2777" stroke="${INK}" stroke-width="2" transform="rotate(-10 2 -35)"/>
        <line x1="3" y1="-41" x2="5" y2="-45" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
      `;
    } else if (id === 'sora') {
      // Nghiên cứu: kính tròn học giả + chiếc lá mầm nhỏ đáng yêu trên đầu
      accessory = `
        <path d="M0,-35 Q2,-43 8,-42 Q5,-36 0,-35 Z" fill="#34D399" stroke="${INK}" stroke-width="1.6"/>
      `;
      faceExtra = `
        <circle cx="-5.5" cy="-21" r="3.8" fill="rgba(255,255,255,0.4)" stroke="${INK}" stroke-width="1.6"/>
        <circle cx="5.5" cy="-21" r="3.8" fill="rgba(255,255,255,0.4)" stroke="${INK}" stroke-width="1.6"/>
        <line x1="-1.7" y1="-21" x2="1.7" y2="-21" stroke="${INK}" stroke-width="1.6"/>
      `;
    } else if (id === 'antigravity') {
      // Thợ xây: mũ bảo hộ vàng cam + kính bảo hộ
      accessory = `
        <path d="M-15,-29 C-14,-42 14,-42 15,-29 Z" fill="#FACC15" stroke="${INK}" stroke-width="2"/>
        <rect x="-17" y="-30" width="34" height="4.5" rx="2.2" fill="#F59E0B" stroke="${INK}" stroke-width="1.8"/>
        <rect x="-8" y="-37" width="16" height="5" rx="2" fill="#FEF08A" stroke="${INK}" stroke-width="1.3"/>
      `;
    }

    // Biểu cảm theo trạng thái
    const isIdle = agent.status === 'idle';
    const isDone = agent.status === 'done';
    const eyes = isIdle
      ? `
        <path d="M-8,-21 Q-5.5,-18.5 -3,-21" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
        <path d="M3,-21 Q5.5,-18.5 8,-21" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
      `
      : isDone
      ? `
        <path d="M-8,-20 Q-5.5,-24 -3,-20" fill="none" stroke="${INK}" stroke-width="2.1" stroke-linecap="round"/>
        <path d="M3,-20 Q5.5,-24 8,-20" fill="none" stroke="${INK}" stroke-width="2.1" stroke-linecap="round"/>
      `
      : `
        <circle cx="-5.5" cy="-21" r="2.2" fill="${INK}"/>
        <circle cx="5.5" cy="-21" r="2.2" fill="${INK}"/>
        <circle cx="-6.2" cy="-21.8" r="0.7" fill="#FFF"/>
        <circle cx="4.8" cy="-21.8" r="0.7" fill="#FFF"/>
      `;

    const mouth = isDone
      ? `<path d="M-3.5,-15.5 Q0,-12 3.5,-15.5" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"/>`
      : `<path d="M-2.8,-15.5 Q0,-13.5 2.8,-15.5" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`;

    return `
      <g class="agent-anim-body" data-agent-anim="${id}" data-status="${agent.status || 'working'}">
        <g transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) scale(${scale})">
          <!-- Bóng nhỏ dưới thân -->
          <ellipse cx="0" cy="8" rx="18" ry="8" fill="rgba(59,47,47,0.18)"/>
          <!-- Thân chibi tròn -->
          <ellipse cx="0" cy="-4" rx="16" ry="14" fill="${color}" stroke="${INK}" stroke-width="2.3"/>
          <!-- Bụng sáng pastel -->
          <ellipse cx="0" cy="-1" rx="9.5" ry="8.5" fill="#FFFDF9" opacity="0.88"/>
          <!-- Hai tay nhỏ -->
          <ellipse cx="-14" cy="-3" rx="5.5" ry="4" fill="${color}" stroke="${INK}" stroke-width="2" transform="rotate(-18 -14 -3)"/>
          <ellipse cx="14" cy="-3" rx="5.5" ry="4" fill="${color}" stroke="${INK}" stroke-width="2" transform="rotate(18 14 -3)"/>
          <!-- Tai mèo chibi -->
          <polygon points="-13,-27 -16,-39 -4,-33" fill="${color}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
          <polygon points="13,-27 16,-39 4,-33" fill="${color}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
          <polygon points="-11.5,-29 -13.2,-35 -7,-32" fill="#FDA4AF" opacity="0.7"/>
          <polygon points="11.5,-29 13.2,-35 7,-32" fill="#FDA4AF" opacity="0.7"/>
          <!-- Đầu chibi -->
          <ellipse cx="0" cy="-21" rx="16.5" ry="14.5" fill="${color}" stroke="${INK}" stroke-width="2.3"/>
          <!-- Mặt sáng ấm -->
          <ellipse cx="0" cy="-19" rx="12.5" ry="10.5" fill="#FFFBF2" opacity="0.92"/>
          <!-- Má hồng -->
          <ellipse cx="-9.5" cy="-17.5" rx="3" ry="1.8" fill="#FB7185" opacity="0.55"/>
          <ellipse cx="9.5" cy="-17.5" rx="3" ry="1.8" fill="#FB7185" opacity="0.55"/>
          <!-- Mắt & Miệng -->
          ${eyes}
          ${mouth}
          ${faceExtra}
          ${accessory}
        </g>
      </g>
    `;
  }

  // Vẽ 1 bàn làm việc tầng 1 kèm máy tính, ghế và đồ dùng riêng theo brief
  function renderLowerWorkstation(agent, u, v) {
    const deskCenter = iso1(u, v);
    const charPos = iso1(u - 0.04, v - 0.06);
    const id = agent.id;

    // Ghế xoay đặt sau nhân vật
    const chair = `
      <g transform="translate(${(charPos.x + 9).toFixed(1)}, ${(charPos.y - 14).toFixed(1)})">
        <ellipse cx="0" cy="14" rx="11" ry="5" fill="#52525B" stroke="${INK}" stroke-width="1.8"/>
        <rect x="-13" y="-15" width="26" height="23" rx="8" fill="#3F3F46" stroke="${INK}" stroke-width="2"/>
        <rect x="-9" y="-11" width="18" height="15" rx="5" fill="#52525B"/>
      </g>
    `;

    // Mặt bàn kem pastel + hộc tủ (đúng kiểu bàn trong ảnh mẫu)
    const desk = `
      ${isoBox(iso1, u - 0.09, v - 0.04, u + 0.09, v + 0.08, 24, '#FFF7E8', '#E5D8C5', '#D6C6B2', 2.2)}
      <!-- Ngăn kéo bên phải bàn -->
      ${isoBox(iso1, u + 0.03, v - 0.03, u + 0.085, v + 0.07, 20, '#F3E7D3', '#C9CDD6', '#B2B8C4', 1.8)}
    `;

    // Màn hình chính (đặt lệch nhẹ sang trái/trước để mặt chibi luôn lộ rõ đáng yêu)
    let props = '';
    const mx = deskCenter.x;
    const my = deskCenter.y - 22;

    if (id === 'gemini') {
      // Gemini: 2 màn hình lớn + bàn phím cơ
      props = `
        <!-- Màn hình trái -->
        <g transform="translate(${(mx - 22).toFixed(1)}, ${(my - 1).toFixed(1)})">
          <rect x="-14" y="-20" width="26" height="18" rx="3" fill="#475569" stroke="${INK}" stroke-width="2" transform="skewY(18)"/>
          <rect x="-11" y="-17" width="20" height="12" rx="1.5" fill="#1E1B4B" transform="skewY(18)"/>
          <line x1="-8" y1="-12" x2="3" y2="-8" stroke="#A78BFA" stroke-width="2" stroke-linecap="round"/>
          <line x1="-8" y1="-7" x2="6" y2="-3" stroke="#34D399" stroke-width="2" stroke-linecap="round"/>
          <line x1="-2" y1="0" x2="-2" y2="6" stroke="${INK}" stroke-width="2.4"/>
        </g>
        <!-- Màn hình phải -->
        <g transform="translate(${(mx + 14).toFixed(1)}, ${(my + 6).toFixed(1)})">
          <rect x="-13" y="-19" width="26" height="18" rx="3" fill="#475569" stroke="${INK}" stroke-width="2" transform="skewY(-14)"/>
          <rect x="-10" y="-16" width="20" height="12" rx="1.5" fill="#1E1B4B" transform="skewY(-14)"/>
          <line x1="-6" y1="-10" x2="5" y2="-13" stroke="#38BDF8" stroke-width="2" stroke-linecap="round"/>
          <line x1="-6" y1="-6" x2="3" y2="-8" stroke="#F472B6" stroke-width="2" stroke-linecap="round"/>
          <line x1="0" y1="0" x2="0" y2="6" stroke="${INK}" stroke-width="2.4"/>
        </g>
        <!-- Bàn phím cơ màu tím pastel -->
        <polygon points="${mx - 12},${my + 8} ${mx + 10},${my + 16} ${mx + 2},${my + 22} ${mx - 20},${my + 14}" fill="#C4B5FD" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
        <!-- Cốc cà phê -->
        <rect x="${mx + 22}" y="${my + 3}" width="8" height="9" rx="2" fill="#FFF" stroke="${INK}" stroke-width="1.6"/>
      `;
    } else if (id === 'muse') {
      // Muse: máy tính + bảng kiểm tra (checklist) + kính lúp
      props = `
        <g transform="translate(${(mx - 14).toFixed(1)}, ${(my + 2).toFixed(1)})">
          <rect x="-14" y="-19" width="28" height="18" rx="3" fill="#475569" stroke="${INK}" stroke-width="2" transform="skewY(16)"/>
          <rect x="-11" y="-16" width="22" height="12" rx="1.5" fill="#DBEAFE" transform="skewY(16)"/>
          <line x1="-7" y1="-11" x2="5" y2="-7" stroke="#2563EB" stroke-width="2"/>
          <line x1="0" y1="0" x2="0" y2="6" stroke="${INK}" stroke-width="2.4"/>
        </g>
        <!-- Bảng kiểm tra (clipboard) có dấu tích xanh -->
        <g transform="translate(${(mx + 20).toFixed(1)}, ${(my + 4).toFixed(1)})">
          <rect x="-9" y="-13" width="18" height="22" rx="2.5" fill="#FFFFFF" stroke="${INK}" stroke-width="1.8" transform="rotate(8)"/>
          <rect x="-4" y="-15" width="8" height="4" rx="1.5" fill="#3B82F6" stroke="${INK}" stroke-width="1.4" transform="rotate(8)"/>
          <path d="M-5,-6 L-2,-3 L3,-8" fill="none" stroke="#16A34A" stroke-width="2" stroke-linecap="round"/>
          <path d="M-5,1 L-2,4 L3,-1" fill="none" stroke="#16A34A" stroke-width="2" stroke-linecap="round"/>
        </g>
        <!-- Kính lúp -->
        <g transform="translate(${(mx - 28).toFixed(1)}, ${(my + 11).toFixed(1)})">
          <circle cx="0" cy="0" r="6" fill="#BAE6FD" stroke="${INK}" stroke-width="1.8"/>
          <line x1="4.5" y1="4.5" x2="10" y2="10" stroke="#92400E" stroke-width="2.6" stroke-linecap="round"/>
        </g>
      `;
    } else if (id === 'mochi') {
      // Mochi: máy tính + bảng vẽ + khay màu + cọ bút
      props = `
        <g transform="translate(${(mx - 18).toFixed(1)}, ${(my + 1).toFixed(1)})">
          <rect x="-13" y="-19" width="26" height="17" rx="3" fill="#475569" stroke="${INK}" stroke-width="2" transform="skewY(16)"/>
          <rect x="-10" y="-16" width="20" height="11" rx="1.5" fill="#FCE7F3" transform="skewY(16)"/>
          <circle cx="-2" cy="-10" r="3.6" fill="#F472B6"/>
          <line x1="0" y1="0" x2="0" y2="6" stroke="${INK}" stroke-width="2.3"/>
        </g>
        <!-- Bảng vẽ kỹ thuật số -->
        <polygon points="${mx - 2},${my + 4} ${mx + 22},${my + 12} ${mx + 12},${my + 22} ${mx - 12},${my + 14}" fill="#334155" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
        <polygon points="${mx},${my + 6} ${mx + 17},${my + 12} ${mx + 11},${my + 19} ${mx - 6},${my + 13}" fill="#FDF2F8"/>
        <!-- Bảng màu họa sĩ & bút vẽ -->
        <ellipse cx="${mx + 24}" cy="${my + 2}" rx="9" ry="6" fill="#FDE68A" stroke="${INK}" stroke-width="1.7"/>
        <circle cx="${mx + 20}" cy="${my + 1}" r="2" fill="#EC4899"/>
        <circle cx="${mx + 25}" cy="${my}" r="2" fill="#3B82F6"/>
        <circle cx="${mx + 28}" cy="${my + 3}" r="2" fill="#10B981"/>
        <line x1="${mx + 14}" y1="${my + 14}" x2="${mx + 24}" y2="${my + 6}" stroke="#EC4899" stroke-width="2.4" stroke-linecap="round"/>
      `;
    } else if (id === 'sora') {
      // Sora: máy tính + chồng sách + kính lúp + ống nhòm
      props = `
        <g transform="translate(${(mx - 15).toFixed(1)}, ${(my + 1).toFixed(1)})">
          <rect x="-13" y="-19" width="26" height="17" rx="3" fill="#475569" stroke="${INK}" stroke-width="2" transform="skewY(16)"/>
          <rect x="-10" y="-16" width="20" height="11" rx="1.5" fill="#D1FAE5" transform="skewY(16)"/>
          <line x1="0" y1="0" x2="0" y2="6" stroke="${INK}" stroke-width="2.3"/>
        </g>
        <!-- Chồng sách nghiên cứu -->
        <g transform="translate(${(mx + 22).toFixed(1)}, ${(my + 5).toFixed(1)})">
          <rect x="-10" y="-2" width="18" height="6" rx="1.5" fill="#10B981" stroke="${INK}" stroke-width="1.6"/>
          <rect x="-9" y="-8" width="17" height="6" rx="1.5" fill="#F59E0B" stroke="${INK}" stroke-width="1.6"/>
          <rect x="-8" y="-14" width="16" height="6" rx="1.5" fill="#3B82F6" stroke="${INK}" stroke-width="1.6"/>
        </g>
        <!-- Ống nhòm & kính lúp -->
        <g transform="translate(${(mx - 24).toFixed(1)}, ${(my + 11).toFixed(1)})">
          <circle cx="-4" cy="0" r="4.2" fill="#065F46" stroke="${INK}" stroke-width="1.7"/>
          <circle cx="4" cy="2" r="4.2" fill="#065F46" stroke="${INK}" stroke-width="1.7"/>
          <circle cx="-4" cy="0" r="1.8" fill="#A7F3D0"/>
          <circle cx="4" cy="2" r="1.8" fill="#A7F3D0"/>
        </g>
        <g transform="translate(${(mx + 4).toFixed(1)}, ${(my + 13).toFixed(1)})">
          <circle cx="0" cy="0" r="4.8" fill="#E0F2FE" stroke="${INK}" stroke-width="1.6"/>
          <line x1="3.5" y1="3.5" x2="8" y2="8" stroke="#78350F" stroke-width="2.2" stroke-linecap="round"/>
        </g>
      `;
    } else if (id === 'antigravity') {
      // Antigravity: máy tính + cờ-lê + bản vẽ xanh + robot nhỏ
      props = `
        <g transform="translate(${(mx - 16).toFixed(1)}, ${(my + 1).toFixed(1)})">
          <rect x="-13" y="-19" width="26" height="17" rx="3" fill="#475569" stroke="${INK}" stroke-width="2" transform="skewY(16)"/>
          <rect x="-10" y="-16" width="20" height="11" rx="1.5" fill="#FFEDD5" transform="skewY(16)"/>
          <line x1="0" y1="0" x2="0" y2="6" stroke="${INK}" stroke-width="2.3"/>
        </g>
        <!-- Bản vẽ xanh (blueprint) -->
        <polygon points="${mx - 2},${my + 6} ${mx + 20},${my + 13} ${mx + 12},${my + 22} ${mx - 10},${my + 15}" fill="#2563EB" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>
        <line x1="${mx + 1}" y1="${my + 11}" x2="${mx + 14}" y2="${my + 15}" stroke="#DBEAFE" stroke-width="1.3"/>
        <!-- Cờ-lê -->
        <g transform="translate(${(mx - 25).toFixed(1)}, ${(my + 11).toFixed(1)}) rotate(-28)">
          <rect x="-8" y="-2" width="16" height="4" rx="1.5" fill="#94A3B8" stroke="${INK}" stroke-width="1.5"/>
          <circle cx="-8" cy="0" r="3.6" fill="#94A3B8" stroke="${INK}" stroke-width="1.5"/>
        </g>
        <!-- Robot nhỏ dễ thương trên góc bàn -->
        <g transform="translate(${(mx + 24).toFixed(1)}, ${(my + 1).toFixed(1)})">
          <line x1="0" y1="-14" x2="0" y2="-19" stroke="${INK}" stroke-width="1.8"/>
          <circle cx="0" cy="-20" r="2.2" fill="#F97316" stroke="${INK}" stroke-width="1.3"/>
          <rect x="-8" y="-14" width="16" height="13" rx="3.5" fill="#E2E8F0" stroke="${INK}" stroke-width="1.8"/>
          <rect x="-5.5" y="-11" width="11" height="5.5" rx="1.5" fill="#0F172A"/>
          <circle cx="-2.5" cy="-8.2" r="1.4" fill="#38BDF8"/>
          <circle cx="2.5" cy="-8.2" r="1.4" fill="#38BDF8"/>
          <rect x="-5.5" y="-1" width="11" height="7" rx="2" fill="#F97316" stroke="${INK}" stroke-width="1.6"/>
        </g>
      `;
    }

    // Ánh sáng màn hình dịu khi bật chế độ ban đêm (dùng rgba để không bị lớp .night-only làm đục)
    const nightMonitorGlow = `
      <ellipse class="night-only" cx="${mx - 6}" cy="${my + 2}" rx="34" ry="16" fill="rgba(147, 197, 253, 0.22)"/>
    `;

    return `
      <g class="svg-agent-hit" data-agent-id="${id}" tabindex="0" role="button" aria-label="${agent.name} — ${agent.role}">
        ${chair}
        ${renderChibiCharacter(agent, charPos.x, charPos.y - 18, 1.03)}
        ${desk}
        ${nightMonitorGlow}
        ${props}
      </g>
    `;
  }

  // Vẽ chip trạng thái nổi phía trên đầu mỗi nhân vật (căn khoảng cách chữ chuẩn, không dính chữ)
  function renderStatusChip(agent, x, y) {
    const meta = getStatusMeta(agent.status);
    const nameText = agent.name;
    const statusText = meta.label;
    const floorKey = agent.floor || (agent.id === 'khang' ? 'upper' : 'lower');

    const nameW = Math.ceil(nameText.length * 7.8) + 8;
    const badgeW = Math.ceil(statusText.length * 6.8) + 22;
    const chipW = 24 + nameW + 6 + badgeW + 6;
    const halfW = chipW / 2;
    const badgeX = halfW - badgeW - 5;

    return `
      <g class="svg-chip-hit chip-float" data-agent-id="${agent.id}" data-chip-id="${agent.id}" data-floor="${floorKey}" tabindex="0" role="button" aria-label="${nameText}: ${statusText}">
        <g transform="translate(${x.toFixed(1)}, ${y.toFixed(1)})">
          <g class="chip-scale">
            <!-- Đuôi mũi tên nhỏ chỉ xuống nhân vật -->
            <polygon points="-5,15 5,15 0,22" fill="#FFFDF9" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
            <!-- Khung chip chính -->
            <rect class="chip-bg" x="${(-halfW).toFixed(1)}" y="-15" width="${chipW}" height="31" rx="15.5" fill="#FFFDF9" stroke="${INK}" stroke-width="2.2"/>
            <!-- Chấm màu riêng của nhân vật -->
            <circle cx="${(-halfW + 13).toFixed(1)}" cy="0.5" r="5" fill="${agent.color || '#F59E0B'}" stroke="${INK}" stroke-width="1.6"/>
            <!-- Tên nhân vật -->
            <text class="chip-name" x="${(-halfW + 23).toFixed(1)}" y="4.5" font-size="12" font-weight="800" fill="${INK}">${nameText}</text>
            <!-- Chip trạng thái có màu riêng -->
            <rect x="${badgeX.toFixed(1)}" y="-10" width="${badgeW}" height="21" rx="10.5" fill="${meta.bg}" stroke="${meta.stroke}" stroke-width="1.5"/>
            <circle cx="${(badgeX + 9).toFixed(1)}" cy="0.5" r="3.2" fill="${meta.fill}"/>
            <text class="chip-status" x="${(badgeX + 16).toFixed(1)}" y="4.4" font-size="10.8" font-weight="800" fill="${meta.stroke}">${statusText}</text>
          </g>
        </g>
      </g>
    `;
  }

  // Hàm dựng toàn bộ SVG văn phòng 2 tầng
  function buildOfficeSVG(agents) {
    const byId = {};
    agents.forEach((a) => { byId[a.id] = a; });

    const khang = byId.khang || { id: 'khang', name: 'Khang', role: 'Giám đốc', color: '#F59E0B', status: 'working' };
    const muse = byId.muse || { id: 'muse', name: 'Muse', role: 'Quản lý & Kiểm tra', color: '#3B82F6', status: 'working' };
    const sora = byId.sora || { id: 'sora', name: 'Sora', role: 'Nghiên cứu', color: '#10B981', status: 'idle' };
    const mochi = byId.mochi || { id: 'mochi', name: 'Mochi', role: 'Họa sĩ asset', color: '#EC4899', status: 'done' };
    const antigravity = byId.antigravity || { id: 'antigravity', name: 'Antigravity', role: 'Thợ xây', color: '#F97316', status: 'working' };
    const gemini = byId.gemini || { id: 'gemini', name: 'Gemini', role: 'Lập trình chính', color: '#8B5CF6', status: 'working' };

    // Tọa độ góc 2 tầng
    const tBack = iso2(0, 0);   // (460, 158)
    const tLeft = iso2(0, 1);   // (95, 310)
    const tRight = iso2(1, 0);  // (825, 310)
    const tFront = iso2(1, 1);  // (460, 462)

    const tBackTop = { x: tBack.x, y: tBack.y - WALL2 };
    const tLeftTop = { x: tLeft.x, y: tLeft.y - WALL2 };
    const tRightTop = { x: tRight.x, y: tRight.y - WALL2 };

    const bBack = iso1(0, 0);   // (460, 477)
    const bLeft = iso1(0, 1);   // (95, 635)
    const bRight = iso1(1, 0);  // (825, 635)
    const bFront = iso1(1, 1);  // (460, 793)

    // Vân sàn gỗ Tầng 2
    let woodPlanksUpper = '';
    for (let i = 1; i < 10; i++) {
      const f = i / 10;
      const pA = iso2(0, f);
      const pB = iso2(1, f);
      woodPlanksUpper += `<line x1="${pA.x.toFixed(1)}" y1="${pA.y.toFixed(1)}" x2="${pB.x.toFixed(1)}" y2="${pB.y.toFixed(1)}" stroke="#A87A4E" stroke-width="1.2" opacity="0.55"/>`;
    }

    // Lưới gạch sàn pastel ấm Tầng 1
    let floorGridLower = '';
    for (let i = 1; i < 8; i++) {
      const f = i / 8;
      const a1 = iso1(0, f), b1 = iso1(1, f);
      const a2 = iso1(f, 0), b2 = iso1(f, 1);
      floorGridLower += `<line x1="${a1.x.toFixed(1)}" y1="${a1.y.toFixed(1)}" x2="${b1.x.toFixed(1)}" y2="${b1.y.toFixed(1)}" stroke="#BCA486" stroke-width="1.1" opacity="0.55"/>`;
      floorGridLower += `<line x1="${a2.x.toFixed(1)}" y1="${a2.y.toFixed(1)}" x2="${b2.x.toFixed(1)}" y2="${b2.y.toFixed(1)}" stroke="#BCA486" stroke-width="1.1" opacity="0.55"/>`;
    }

    // Nan gỗ trang trí tường phải tầng trên (như ảnh mẫu)
    let wallSlats = '';
    const slatRanges = [[0.04, 0.24], [0.76, 0.94]];
    slatRanges.forEach(([start, end]) => {
      for (let s = start; s <= end; s += 0.032) {
        const pBot = iso2(s, 0);
        wallSlats += `<line x1="${pBot.x.toFixed(1)}" y1="${(pBot.y - 4).toFixed(1)}" x2="${pBot.x.toFixed(1)}" y2="${(pBot.y - WALL2 + 6).toFixed(1)}" stroke="#8C6239" stroke-width="3" opacity="0.72"/>`;
      }
    });

    // Vị trí Khang (Tầng 2)
    const khangPos = iso2(0.41, 0.28);
    const execDeskCenter = iso2(0.45, 0.43);

    // Vị trí 5 bàn Tầng 1 (xếp theo painter's order từ sau ra trước: u+v tăng dần)
    const lowerSlots = [
      { agent: muse, u: 0.21, v: 0.48 },        // u+v = 0.69
      { agent: sora, u: 0.51, v: 0.22 },        // u+v = 0.73
      { agent: mochi, u: 0.29, v: 0.77 },       // u+v = 1.06
      { agent: antigravity, u: 0.76, v: 0.37 }, // u+v = 1.13
      { agent: gemini, u: 0.61, v: 0.67 }       // u+v = 1.28
    ];

    const workstationsHTML = lowerSlots
      .map((slot) => renderLowerWorkstation(slot.agent, slot.u, slot.v))
      .join('');

    // Chip trạng thái cho 6 người — bố trí cao ráo, hoàn toàn không đè nhau hay che mặt
    const chipOffsets = {
      muse: { dx: -8, dy: -76 },
      sora: { dx: 8, dy: -76 },
      mochi: { dx: -24, dy: -72 },
      gemini: { dx: -22, dy: -62 },
      antigravity: { dx: 46, dy: -66 }
    };
    const chipsHTML = [
      renderStatusChip(khang, khangPos.x, khangPos.y - 72),
      ...lowerSlots.map((slot) => {
        const p = iso1(slot.u - 0.04, slot.v - 0.06);
        const off = chipOffsets[slot.agent.id] || { dx: 0, dy: -74 };
        return renderStatusChip(slot.agent, p.x + off.dx, p.y + off.dy);
      })
    ].join('');

    // Vị trí cửa sổ tầng 2 (tường trái)
    const winL1 = iso2(0, 0.66), winL2 = iso2(0, 0.22);
    const winPoly = [
      { x: winL1.x, y: winL1.y - 18 },
      { x: winL2.x, y: winL2.y - 18 },
      { x: winL2.x, y: winL2.y - 110 },
      { x: winL1.x, y: winL1.y - 110 }
    ];

    // Vị trí khung tranh tường phải tầng 2
    const art1 = iso2(0.30, 0), art2 = iso2(0.71, 0);
    const artPoly = [
      { x: art1.x, y: art1.y - 54 },
      { x: art2.x, y: art2.y - 54 },
      { x: art2.x, y: art2.y - 104 },
      { x: art1.x, y: art1.y - 104 }
    ];
    const artMid = { x: (art1.x + art2.x) / 2, y: (art1.y + art2.y) / 2 - 76 };

    // Két sắt pastel tầng 2 (bên phải)
    const safeU = 0.77, safeV = 0.24;
    const safeDoorBase = iso2(safeU - 0.06, safeV + 0.05);

    // Bể cá cảnh phía trước tầng 2 (tâm kính bể cá)
    const aqPos = iso2(0.585, 0.815);

    // Chậu cây xanh tầng 2
    const plantPos = iso2(0.73, 0.62);

    // Cửa ra vào tầng 2 (tường trái)
    const door2A = iso2(0, 0.92), door2B = iso2(0, 0.74);

    // Cửa vào tầng 1 (tường phải gần góc sau)
    const door1A = iso1(0.10, 0), door1B = iso1(0.28, 0);

    // Bảng biểu đồ tường phải tầng 1
    const chartA = iso1(0.54, 0), chartB = iso1(0.88, 0);

    // Bảng ghim & máy lạnh tường trái tầng 1
    const pinA = iso1(0, 0.88), pinB = iso1(0, 0.66);
    const acA = iso1(0, 0.94), acB = iso1(0, 0.70);

    // Cửa sổ tầng 1 (tường trái)
    const w1A = iso1(0, 0.58), w1B = iso1(0, 0.34);

    return `
      <svg class="office-svg" viewBox="0 0 920 845" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mô hình Văn Phòng Làm Game 2 tầng">
        <defs>
          <linearGradient id="skyDay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#BAE6FD"/>
            <stop offset="100%" stop-color="#E0F2FE"/>
          </linearGradient>
          <linearGradient id="skyNight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1E1B4B"/>
            <stop offset="100%" stop-color="#312E81"/>
          </linearGradient>
          <linearGradient id="warmLamp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#FDE047" stop-opacity="0.52"/>
            <stop offset="100%" stop-color="#FDE047" stop-opacity="0"/>
          </linearGradient>
          <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#3B2F2F" flood-opacity="0.16"/>
          </filter>
        </defs>

        <!-- Bóng đổ mềm của toàn tòa nhà dollhouse -->
        <polygon points="460,828 846,664 846,644 460,804 74,644 74,664" fill="rgba(59,47,47,0.16)"/>

        <g filter="url(#softShadow)">
          <!-- ===============================================================
               KHUNG CẮT MỞ NGOÀI (TƯỜNG DÀY CHARCOAL GIỐNG ẢNH MẪU)
               =============================================================== -->
          <!-- Tường viền ngoài bên trái & phải xuyên suốt 2 tầng -->
          <polygon points="77,170 460,8 843,170 843,322 825,330 825,657 460,815 95,657 95,330 77,322" fill="#4D4744" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>

          <!-- ===============================================================
               TẦNG 1 — PHÒNG LÀM VIỆC CHUNG (VẼ TRƯỚC ĐỂ SÀN TẦNG 2 ĐÈ LÊN GỌN)
               =============================================================== -->
          <g class="svg-room-group" id="roomLower" data-room="lower">
            <!-- Tường trái tầng 1 (xanh mint pastel) -->
            <polygon points="${pts([bLeft, bBack, { x: bBack.x, y: tFront.y }, { x: bLeft.x, y: tLeft.y + 18 }])}" fill="#DFF7F0" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
            <!-- Tường phải tầng 1 (kem mint dịu) -->
            <polygon points="${pts([bBack, bRight, { x: bRight.x, y: tRight.y + 18 }, { x: bBack.x, y: tFront.y }])}" fill="#EDF7F2" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>

            <!-- Sàn tầng 1 (gạch/gỗ sáng pastel) -->
            <polygon points="${pts([bBack, bRight, bFront, bLeft])}" fill="#DFCBB2" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
            ${floorGridLower}

            <!-- Cửa sổ tầng 1 (tường trái) -->
            <polygon points="${pts([
              { x: w1A.x, y: w1A.y - 42 },
              { x: w1B.x, y: w1B.y - 42 },
              { x: w1B.x, y: w1B.y - 106 },
              { x: w1A.x, y: w1A.y - 106 }
            ])}" fill="url(#skyDay)" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
            <polygon class="night-only" points="${pts([
              { x: w1A.x, y: w1A.y - 42 },
              { x: w1B.x, y: w1B.y - 42 },
              { x: w1B.x, y: w1B.y - 106 },
              { x: w1A.x, y: w1A.y - 106 }
            ])}" fill="url(#skyNight)"/>
            <!-- Thanh chia cửa sổ & tán cây ngoài trời -->
            <line x1="${((w1A.x + w1B.x) / 2).toFixed(1)}" y1="${((w1A.y + w1B.y) / 2 - 42).toFixed(1)}" x2="${((w1A.x + w1B.x) / 2).toFixed(1)}" y2="${((w1A.y + w1B.y) / 2 - 106).toFixed(1)}" stroke="#8C6239" stroke-width="3"/>

            <!-- Máy điều hòa (AC) trên tường trái tầng 1 -->
            <polygon points="${pts([
              { x: acA.x + 8, y: acA.y - 178 },
              { x: acB.x + 8, y: acB.y - 178 },
              { x: acB.x + 8, y: acB.y - 208 },
              { x: acA.x + 8, y: acA.y - 208 }
            ])}" fill="#FFFFFF" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
            <line x1="${acA.x + 14}" y1="${acA.y - 186}" x2="${acB.x + 2}" y2="${acB.y - 186}" stroke="#94A3B8" stroke-width="2"/>

            <!-- Bảng ghim poster nhân vật chibi trên tường trái tầng 1 -->
            <polygon points="${pts([
              { x: pinA.x + 12, y: pinA.y - 68 },
              { x: pinB.x + 12, y: pinB.y - 68 },
              { x: pinB.x + 12, y: pinB.y - 152 },
              { x: pinA.x + 12, y: pinA.y - 152 }
            ])}" fill="#FFF7ED" stroke="#9A6B42" stroke-width="3" stroke-linejoin="round"/>
            <circle cx="${pinA.x + 34}" cy="${pinA.y - 122}" r="8" fill="#FDE68A" stroke="${INK}" stroke-width="1.5"/>
            <circle cx="${pinA.x + 62}" cy="${pinA.y - 106}" r="8" fill="#FBCFE8" stroke="${INK}" stroke-width="1.5"/>
            <rect x="${pinA.x + 26}" y="${pinA.y - 104}" width="18" height="20" rx="2" fill="#BFDBFE" stroke="${INK}" stroke-width="1.5"/>

            <!-- Cửa vào văn phòng + thảm chào mừng đỏ (tường phải tầng 1) -->
            <polygon points="${pts([
              { x: door1A.x, y: door1A.y - 2 },
              { x: door1B.x, y: door1B.y - 2 },
              { x: door1B.x, y: door1B.y - 96 },
              { x: door1A.x, y: door1A.y - 96 }
            ])}" fill="#C8754B" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
            <circle cx="${door1B.x - 10}" cy="${door1B.y - 44}" r="3.4" fill="#FDE047" stroke="${INK}" stroke-width="1.4"/>
            <!-- Thảm đỏ trước cửa -->
            <polygon points="${pts([iso1(0.09, 0.02), iso1(0.29, 0.02), iso1(0.29, 0.13), iso1(0.09, 0.13)])}" fill="#DC2626" stroke="${INK}" stroke-width="1.8"/>

            <!-- Bảng trắng biểu đồ tiến độ (tường phải tầng 1) -->
            <polygon points="${pts([
              { x: chartA.x, y: chartA.y - 78 },
              { x: chartB.x, y: chartB.y - 78 },
              { x: chartB.x, y: chartB.y - 160 },
              { x: chartA.x, y: chartA.y - 160 }
            ])}" fill="#FFFFFF" stroke="#64748B" stroke-width="3.2" stroke-linejoin="round"/>
            <!-- Cột biểu đồ xanh + mũi tên tăng đỏ -->
            <polygon points="${chartA.x + 18},${chartA.y - 94} ${chartA.x + 28},${chartA.y - 90} ${chartA.x + 28},${chartA.y - 122} ${chartA.x + 18},${chartA.y - 126}" fill="#60A5FA" stroke="${INK}" stroke-width="1.3"/>
            <polygon points="${chartA.x + 34},${chartA.y - 87} ${chartA.x + 44},${chartA.y - 83} ${chartA.x + 44},${chartA.y - 130} ${chartA.x + 34},${chartA.y - 134}" fill="#34D399" stroke="${INK}" stroke-width="1.3"/>
            <polyline points="${chartA.x + 56},${chartA.y - 84} ${chartA.x + 74},${chartA.y - 98} ${chartA.x + 88},${chartA.y - 82} ${chartA.x + 108},${chartA.y - 108}" fill="none" stroke="#EF4444" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>

            <!-- Quầy cà phê, lò vi sóng & bình nước nóng lạnh (góc phải tầng 1) -->
            ${isoBox(iso1, 0.66, 0.03, 0.86, 0.15, 28, '#FFF3DF', '#E5D5BE', '#D4C2A8', 2)}
            <!-- Máy pha cà phê -->
            ${isoBox(iso1, 0.74, 0.04, 0.82, 0.11, 44, '#475569', '#334155', '#1E293B', 1.8)}
            <!-- Cây nước xanh pastel -->
            ${isoBox(iso1, 0.88, 0.06, 0.96, 0.16, 42, '#7DD3FC', '#38BDF8', '#0284C7', 2)}
            <!-- Bình nước tròn trên cùng -->
            <ellipse cx="${iso1(0.92, 0.11).x.toFixed(1)}" cy="${(iso1(0.92, 0.11).y - 52).toFixed(1)}" rx="12" ry="14" fill="#BAE6FD" stroke="${INK}" stroke-width="2" opacity="0.9"/>

            <!-- 5 Bàn làm việc & 5 Nhân vật tầng dưới -->
            ${workstationsHTML}

            <!-- Phủ màu đêm dịu cho Tầng 1 -->
            <polygon class="room-ambient-tint" points="${pts([bBack, bRight, bFront, bLeft])}" fill="#1E1B4B"/>

            <!-- Mặt cắt nền móng Tầng 1 -->
            <polygon points="${pts([bLeft, bFront, { x: bFront.x, y: bFront.y + 22 }, { x: bLeft.x, y: bLeft.y + 22 }])}" fill="#5B524E" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
            <polygon points="${pts([bRight, bFront, { x: bFront.x, y: bFront.y + 22 }, { x: bRight.x, y: bRight.y + 22 }])}" fill="#3F3936" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
          </g>

          <!-- ===============================================================
               TẦNG 2 — PHÒNG GIÁM ĐỐC (KHANG)
               =============================================================== -->
          <g class="svg-room-group" id="roomUpper" data-room="upper">
            <!-- Tường trái tầng 2 (xanh mint pastel ấm) -->
            <polygon points="${pts([tLeft, tBack, tBackTop, tLeftTop])}" fill="#DFF7F0" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
            <!-- Tường phải tầng 2 (kem ấm + nan gỗ) -->
            <polygon points="${pts([tBack, tRight, tRightTop, tBackTop])}" fill="#F6EDE0" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
            ${wallSlats}

            <!-- Sàn gỗ mật ong tầng 2 -->
            <polygon points="${pts([tBack, tRight, tFront, tLeft])}" fill="#CE9F72" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
            ${woodPlanksUpper}

            <!-- Cửa gỗ phòng giám đốc (bên trái) -->
            <polygon points="${pts([
              { x: door2A.x, y: door2A.y - 2 },
              { x: door2B.x, y: door2B.y - 2 },
              { x: door2B.x, y: door2B.y - 102 },
              { x: door2A.x, y: door2A.y - 102 }
            ])}" fill="#9A6B42" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
            <circle cx="${door2B.x - 8}" cy="${door2B.y - 46}" r="3.4" fill="#FDE047" stroke="${INK}" stroke-width="1.4"/>

            <!-- Cửa sổ kính lớn nhìn ra thành phố (tường trái tầng 2) -->
            <polygon points="${pts(winPoly)}" fill="url(#skyDay)" stroke="#8C5A32" stroke-width="4" stroke-linejoin="round"/>
            <!-- Tòa nhà thành phố ban ngày -->
            <g class="day-only">
              <polygon points="${winL1.x + 28},${winL1.y - 30} ${winL1.x + 62},${winL1.y - 44} ${winL1.x + 62},${winL1.y - 92} ${winL1.x + 28},${winL1.y - 78}" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.4"/>
              <polygon points="${winL1.x + 74},${winL1.y - 48} ${winL1.x + 118},${winL1.y - 66} ${winL1.x + 118},${winL1.y - 118} ${winL1.x + 74},${winL1.y - 100}" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.4"/>
              <circle cx="${winL2.x - 24}" cy="${winL2.y - 84}" r="11" fill="#FEF08A" opacity="0.9"/>
            </g>
            <!-- Bầu trời đêm có sao & cửa sổ sáng đèn -->
            <g class="night-only">
              <polygon points="${pts(winPoly)}" fill="url(#skyNight)"/>
              <circle cx="${winL2.x - 26}" cy="${winL2.y - 84}" r="9" fill="#FEF08A"/>
              <circle cx="${winL1.x + 42}" cy="${winL1.y - 86}" r="1.8" fill="#FFF"/>
              <circle cx="${winL1.x + 86}" cy="${winL1.y - 98}" r="2" fill="#FFF"/>
              <circle cx="${winL1.x + 115}" cy="${winL1.y - 78}" r="1.5" fill="#FDE047"/>
              <rect x="${winL1.x + 36}" y="${winL1.y - 64}" width="6" height="6" fill="#FDE047"/>
              <rect x="${winL1.x + 86}" y="${winL1.y - 74}" width="6" height="6" fill="#FDE047"/>
            </g>
            <!-- Khung đố cửa sổ -->
            <line x1="${((winL1.x * 2 + winL2.x) / 3).toFixed(1)}" y1="${((winL1.y * 2 + winL2.y) / 3 - 18).toFixed(1)}" x2="${((winL1.x * 2 + winL2.x) / 3).toFixed(1)}" y2="${((winL1.y * 2 + winL2.y) / 3 - 110).toFixed(1)}" stroke="#8C5A32" stroke-width="3.2"/>
            <line x1="${((winL1.x + winL2.x * 2) / 3).toFixed(1)}" y1="${((winL1.y + winL2.y * 2) / 3 - 18).toFixed(1)}" x2="${((winL1.x + winL2.x * 2) / 3).toFixed(1)}" y2="${((winL1.y + winL2.y * 2) / 3 - 110).toFixed(1)}" stroke="#8C5A32" stroke-width="3.2"/>

            <!-- Thảm golf mini + cờ vàng nhỏ dưới cửa sổ (chi tiết đặc trưng ảnh mẫu!) -->
            <polygon points="${pts([iso2(0.03, 0.64), iso2(0.15, 0.64), iso2(0.15, 0.24), iso2(0.03, 0.24)])}" fill="#84CC16" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
            <line x1="${iso2(0.09, 0.56).x.toFixed(1)}" y1="${iso2(0.09, 0.56).y.toFixed(1)}" x2="${iso2(0.09, 0.56).x.toFixed(1)}" y2="${(iso2(0.09, 0.56).y - 34).toFixed(1)}" stroke="${INK}" stroke-width="2"/>
            <polygon points="${iso2(0.09, 0.56).x},${iso2(0.09, 0.56).y - 34} ${iso2(0.09, 0.56).x + 16},${iso2(0.09, 0.56).y - 28} ${iso2(0.09, 0.56).x},${iso2(0.09, 0.56).y - 22}" fill="#FBBF24" stroke="${INK}" stroke-width="1.6"/>
            <circle cx="${iso2(0.10, 0.34).x.toFixed(1)}" cy="${iso2(0.10, 0.34).y.toFixed(1)}" r="3" fill="#FFF" stroke="${INK}" stroke-width="1.2"/>

            <!-- Kệ sách gỗ cao (góc sau tầng 2) -->
            ${isoBox(iso2, 0.04, 0.02, 0.20, 0.14, 78, '#9A6338', '#83512B', '#6E4221', 2.2)}
            <!-- Sách màu bên trong kệ -->
            <rect x="${iso2(0.08, 0.12).x - 10}" y="${iso2(0.08, 0.12).y - 62}" width="6" height="14" fill="#EF4444" stroke="${INK}" stroke-width="1.2"/>
            <rect x="${iso2(0.08, 0.12).x - 3}" y="${iso2(0.08, 0.12).y - 60}" width="6" height="14" fill="#3B82F6" stroke="${INK}" stroke-width="1.2"/>
            <rect x="${iso2(0.08, 0.12).x + 4}" y="${iso2(0.08, 0.12).y - 58}" width="6" height="14" fill="#10B981" stroke="${INK}" stroke-width="1.2"/>

            <!-- Khung tranh chữ treo tường phải -->
            <polygon points="${pts(artPoly)}" fill="#FFFDF5" stroke="#7C4D2B" stroke-width="4.5" stroke-linejoin="round"/>
            <text x="${artMid.x.toFixed(1)}" y="${(artMid.y + 4).toFixed(1)}" text-anchor="middle" font-size="14" font-weight="900" fill="${INK}" transform="skewY(22.5) translate(0, ${(-artMid.x * 0.414).toFixed(1)})">GAME STUDIO</text>

            <!-- Bình hoa đào đỏ góc phải -->
            <g transform="translate(${iso2(0.75, 0.08).x.toFixed(1)}, ${iso2(0.75, 0.08).y.toFixed(1)})">
              <ellipse cx="0" cy="-6" rx="8" ry="10" fill="#B45309" stroke="${INK}" stroke-width="1.8"/>
              <path d="M0,-14 Q-10,-32 -16,-40 M0,-14 Q4,-34 14,-44 M0,-20 Q-2,-34 -2,-48" fill="none" stroke="#5C3A21" stroke-width="2.2" stroke-linecap="round"/>
              <circle cx="-15" cy="-39" r="4" fill="#F43F5E"/>
              <circle cx="-6" cy="-30" r="3.5" fill="#FB7185"/>
              <circle cx="13" cy="-42" r="4" fill="#F43F5E"/>
              <circle cx="4" cy="-35" r="3.5" fill="#FDA4AF"/>
              <circle cx="-2" cy="-47" r="3.5" fill="#F43F5E"/>
            </g>

            <!-- Thảm đỏ viền kem dưới bàn giám đốc -->
            <polygon points="${pts([iso2(0.24, 0.18), iso2(0.68, 0.18), iso2(0.68, 0.62), iso2(0.24, 0.62)])}" fill="#DC2626" stroke="#FEF3C7" stroke-width="4.5" stroke-linejoin="round"/>
            <polygon points="${pts([iso2(0.27, 0.21), iso2(0.65, 0.21), iso2(0.65, 0.59), iso2(0.27, 0.59)])}" fill="none" stroke="#FDE68A" stroke-width="1.6"/>

            <!-- Khang (Giám đốc) + Ghế giám đốc + Bàn lớn -->
            <g class="svg-agent-hit" data-agent-id="khang" tabindex="0" role="button" aria-label="${khang.name} — ${khang.role}">
              <!-- Ghế da giám đốc cao cấp -->
              <g transform="translate(${(khangPos.x + 12).toFixed(1)}, ${(khangPos.y - 16).toFixed(1)})">
                <rect x="-20" y="-26" width="40" height="42" rx="12" fill="#3F3F46" stroke="${INK}" stroke-width="2.5"/>
                <rect x="-15" y="-21" width="30" height="30" rx="8" fill="#52525B"/>
              </g>
              <!-- Nhân vật Khang chibi -->
              ${renderChibiCharacter(khang, khangPos.x, khangPos.y - 10, 1.06)}
              <!-- Bàn giám đốc gỗ gụ lớn -->
              ${isoBox(iso2, 0.30, 0.34, 0.61, 0.52, 34, '#9A5B32', '#7C4624', '#63361B', 2.4)}
              <!-- Laptop trên bàn giám đốc -->
              <g transform="translate(${(execDeskCenter.x - 4).toFixed(1)}, ${(execDeskCenter.y - 36).toFixed(1)})">
                <ellipse class="night-only" cx="2" cy="-2" rx="30" ry="14" fill="rgba(253, 224, 71, 0.28)"/>
                <polygon points="-16,2 4,10 18,3 -2,-5" fill="#CBD5E1" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
                <polygon points="-16,2 -18,-15 2,-7 4,10" fill="#94A3B8" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
              </g>
              <!-- Ống bút + bảng tên vàng -->
              <rect x="${execDeskCenter.x + 24}" y="${execDeskCenter.y - 34}" width="9" height="11" rx="2" fill="#334155" stroke="${INK}" stroke-width="1.6"/>
              <line x1="${execDeskCenter.x + 27}" y1="${execDeskCenter.y - 34}" x2="${execDeskCenter.x + 25}" y2="${execDeskCenter.y - 42}" stroke="#EF4444" stroke-width="2"/>
              <line x1="${execDeskCenter.x + 30}" y1="${execDeskCenter.y - 34}" x2="${execDeskCenter.x + 33}" y2="${execDeskCenter.y - 41}" stroke="#FACC15" stroke-width="2"/>
              <polygon points="${execDeskCenter.x - 32},${execDeskCenter.y - 22} ${execDeskCenter.x - 16},${execDeskCenter.y - 16} ${execDeskCenter.x - 16},${execDeskCenter.y - 25} ${execDeskCenter.x - 32},${execDeskCenter.y - 31}" fill="#FBBF24" stroke="${INK}" stroke-width="1.6"/>
            </g>

            <!-- Két sắt màu xanh mint pastel (có cánh cửa mở hé lộ vàng & băng game!) -->
            ${isoBox(iso2, safeU, safeV, safeU + 0.14, safeV + 0.14, 52, '#CFEFF2', '#9ED7DE', '#80C4CD', 2.3)}
            <!-- Khoang bên trong két sắt có thỏi vàng & tài liệu mật -->
            <polygon points="${pts([
              { x: iso2(safeU, safeV + 0.14).x + 6, y: iso2(safeU, safeV + 0.14).y - 44 },
              { x: iso2(safeU + 0.14, safeV + 0.14).x - 6, y: iso2(safeU + 0.14, safeV + 0.14).y - 44 },
              { x: iso2(safeU + 0.14, safeV + 0.14).x - 6, y: iso2(safeU + 0.14, safeV + 0.14).y - 8 },
              { x: iso2(safeU, safeV + 0.14).x + 6, y: iso2(safeU, safeV + 0.14).y - 8 }
            ])}" fill="#FEF9C3" stroke="${INK}" stroke-width="1.8"/>
            <rect x="${iso2(safeU + 0.04, safeV + 0.14).x - 3}" y="${iso2(safeU + 0.04, safeV + 0.14).y - 22}" width="16" height="8" rx="2" fill="#F59E0B" stroke="${INK}" stroke-width="1.4"/>
            <rect x="${iso2(safeU + 0.05, safeV + 0.14).x + 2}" y="${iso2(safeU + 0.05, safeV + 0.14).y - 33}" width="13" height="9" rx="1.5" fill="#34D399" stroke="${INK}" stroke-width="1.4"/>
            <!-- Cánh cửa két mở hé -->
            <polygon points="${safeDoorBase.x},${safeDoorBase.y} ${safeDoorBase.x - 16},${safeDoorBase.y + 18} ${safeDoorBase.x - 16},${safeDoorBase.y - 30} ${safeDoorBase.x},${safeDoorBase.y - 48}" fill="#9ED7DE" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
            <circle cx="${safeDoorBase.x - 8}" cy="${safeDoorBase.y - 16}" r="5" fill="#E2E8F0" stroke="${INK}" stroke-width="1.8"/>

            <!-- Sofa tiếp khách + bàn trà (góc trước-trái tầng 2) -->
            <!-- Bàn trà gỗ + ấm trà -->
            ${isoBox(iso2, 0.25, 0.56, 0.40, 0.68, 18, '#B87A4B', '#9A6338', '#7C4D2B', 2)}
            <g transform="translate(${iso2(0.32, 0.62).x.toFixed(1)}, ${(iso2(0.32, 0.62).y - 21).toFixed(1)})">
              <ellipse cx="-4" cy="0" rx="7" ry="5.5" fill="#FFFDF9" stroke="${INK}" stroke-width="1.6"/>
              <circle cx="8" cy="3" r="3" fill="#FFFDF9" stroke="${INK}" stroke-width="1.4"/>
              <circle cx="14" cy="0" r="3" fill="#FFFDF9" stroke="${INK}" stroke-width="1.4"/>
              <!-- Khói trà bốc lên mượt mà (animate bằng rAF) -->
              <path class="steam-wisp" data-steam="0" d="M-4,-8 Q-7,-14 -3,-20" fill="none" stroke="#FFFDF9" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
            </g>
            <!-- Sofa xám êm ái -->
            ${isoBox(iso2, 0.14, 0.72, 0.44, 0.86, 26, '#64748B', '#475569', '#334155', 2.3)}
            ${isoBox(iso2, 0.14, 0.81, 0.44, 0.87, 42, '#64748B', '#475569', '#334155', 2.2)}

            <!-- Bể cá cảnh có cá bơi mượt (góc trước-giữa tầng 2) -->
            ${isoBox(iso2, 0.50, 0.76, 0.67, 0.87, 22, '#6B5B53', '#524640', '#3E3530', 2.1)}
            <!-- Phần kính bể cá trong xanh -->
            <g transform="translate(0, -22)">
              ${isoBox(iso2, 0.50, 0.76, 0.67, 0.87, 28, 'rgba(186,230,253,0.75)', 'rgba(125,211,252,0.72)', 'rgba(56,189,248,0.68)', 2)}
              <!-- Cá nhỏ bơi trong bể (animate bằng requestAnimationFrame) -->
              <g id="aquariumFish1" transform="translate(${(aqPos.x - 4).toFixed(1)}, ${(aqPos.y - 12).toFixed(1)})">
                <ellipse cx="0" cy="0" rx="5.5" ry="3.2" fill="#FB923C" stroke="${INK}" stroke-width="1.2"/>
                <polygon points="-5,0 -9,-3 -9,3" fill="#F97316"/>
              </g>
              <g id="aquariumFish2" transform="translate(${(aqPos.x + 12).toFixed(1)}, ${(aqPos.y - 6).toFixed(1)})">
                <ellipse cx="0" cy="0" rx="4.5" ry="2.6" fill="#FDE047" stroke="${INK}" stroke-width="1.2"/>
                <polygon points="4,0 8,-2.5 8,2.5" fill="#F59E0B"/>
              </g>
            </g>

            <!-- Chậu cây xanh lá to (bên cạnh bể cá) -->
            <g transform="translate(${plantPos.x.toFixed(1)}, ${(plantPos.y - 4).toFixed(1)})">
              <polygon points="-12,-14 12,-14 9,4 -9,4" fill="#E5E7EB" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
              <ellipse cx="0" cy="-14" rx="12" ry="4.5" fill="#92400E" stroke="${INK}" stroke-width="1.8"/>
              <path d="M0,-14 Q-16,-28 -22,-22 Q-14,-12 0,-14 Z" fill="#22C55E" stroke="${INK}" stroke-width="1.8"/>
              <path d="M0,-14 Q18,-28 24,-20 Q14,-11 0,-14 Z" fill="#16A34A" stroke="${INK}" stroke-width="1.8"/>
              <path d="M0,-14 Q-10,-38 -2,-44 Q6,-34 0,-14 Z" fill="#4ADE80" stroke="${INK}" stroke-width="1.8"/>
              <path d="M0,-14 Q14,-38 16,-40 Q8,-24 0,-14 Z" fill="#22C55E" stroke="${INK}" stroke-width="1.8"/>
            </g>

            <!-- Phủ màu đêm dịu cho Tầng 2 -->
            <polygon class="room-ambient-tint" points="${pts([tBack, tRight, tFront, tLeft])}" fill="#1E1B4B"/>

            <!-- Mặt cắt sàn giữa 2 tầng (tách biệt rõ ràng Tầng 2 và Tầng 1) -->
            <polygon points="${pts([tLeft, tFront, { x: tFront.x, y: tFront.y + 22 }, { x: tLeft.x, y: tLeft.y + 22 }])}" fill="#5B524E" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
            <polygon points="${pts([tRight, tFront, { x: tFront.x, y: tFront.y + 22 }, { x: tRight.x, y: tRight.y + 22 }])}" fill="#3F3936" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
          </g>

          <!-- ===============================================================
               BIỂN HIỆU "OFFICE" TRÊN MÁI NHÀ (GIỐNG ẢNH MẪU 100%)
               =============================================================== -->
          <g id="roofSignboard">
            <!-- Chân chống biển hiệu -->
            <line x1="158" y1="152" x2="158" y2="124" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
            <line x1="258" y1="109" x2="258" y2="82" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
            <line x1="365" y1="64" x2="365" y2="38" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
            <!-- Khung gỗ dày biển OFFICE -->
            <polygon points="118,144 412,18 424,25 424,78 130,204 118,197" fill="#A16E44" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>
            <!-- Mặt kem sáng của biển hiệu -->
            <polygon points="130,149 418,26 418,75 130,198" fill="#FFF7DC" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
            <!-- Chữ OFFICE lớn rõ nét theo góc nghiêng isometric -->
            <text x="274" y="132" text-anchor="middle" font-size="40" font-weight="900" letter-spacing="4" fill="#F59E0B" stroke="${INK}" stroke-width="2.2" transform="rotate(-23.2 274 132)">OFFICE</text>
            <!-- Đèn chiếu biển hiệu gắn trên mép trên bảng OFFICE -->
            <path d="M196,112 Q204,92 218,98" fill="none" stroke="${INK}" stroke-width="2.6"/>
            <circle cx="220" cy="100" r="5" fill="#FEF08A" stroke="${INK}" stroke-width="1.8"/>
            <path d="M286,73 Q294,53 308,59" fill="none" stroke="${INK}" stroke-width="2.6"/>
            <circle cx="310" cy="61" r="5" fill="#FEF08A" stroke="${INK}" stroke-width="1.8"/>
            <path d="M368,38 Q376,18 390,24" fill="none" stroke="${INK}" stroke-width="2.6"/>
            <circle cx="392" cy="26" r="5" fill="#FEF08A" stroke="${INK}" stroke-width="1.8"/>
            <!-- Quầng đèn sáng vàng vào ban đêm -->
            <polygon class="night-only" points="220,104 176,176 258,142" fill="url(#warmLamp)"/>
            <polygon class="night-only" points="310,65 266,137 348,103" fill="url(#warmLamp)"/>
            <polygon class="night-only" points="392,30 348,102 420,72" fill="url(#warmLamp)"/>
            <!-- Chú mèo chibi nhỏ ló đầu trên góc trái biển OFFICE (y như ảnh mẫu!) -->
            <g transform="translate(152, 128) rotate(-18)">
              <polygon points="-13,-4 -15,-18 -4,-11" fill="#C49A6C" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
              <polygon points="13,-4 15,-18 4,-11" fill="#C49A6C" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
              <ellipse cx="0" cy="0" rx="16" ry="13" fill="#FFFDF5" stroke="${INK}" stroke-width="2.2"/>
              <path d="M-8,-1 Q-5,-5 -2,-1" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
              <path d="M2,-1 Q5,-5 8,-1" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
              <path d="M-2.5,3 Q0,6 2.5,3" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
              <ellipse cx="-10" cy="9" rx="4.5" ry="3.5" fill="#FFFDF5" stroke="${INK}" stroke-width="1.8"/>
              <ellipse cx="10" cy="9" rx="4.5" ry="3.5" fill="#FFFDF5" stroke="${INK}" stroke-width="1.8"/>
            </g>
          </g>

          <!-- ===============================================================
               NHÃN TẦNG NHỎ GỌN BÊN CẠNH VÁCH NGOÀI
               =============================================================== -->
          <g pointer-events="none">
            <rect x="14" y="218" width="66" height="24" rx="12" fill="#FFF9EB" stroke="${INK}" stroke-width="2"/>
            <text x="47" y="234" text-anchor="middle" font-size="11.5" font-weight="800" fill="${INK}">TẦNG 2</text>

            <rect x="14" y="544" width="66" height="24" rx="12" fill="#FFF9EB" stroke="${INK}" stroke-width="2"/>
            <text x="47" y="560" text-anchor="middle" font-size="11.5" font-weight="800" fill="${INK}">TẦNG 1</text>
          </g>
        </g>

        <!-- ===============================================================
             LỚP CHIP TRẠNG THÁI NỔI TRÊN CÙNG (KHÔNG BAO GIỜ BỊ CHE)
             =============================================================== -->
        <g id="chipsLayer">
          ${chipsHTML}
        </g>
      </svg>
    `;
  }

  global.OfficeSVG = {
    buildOfficeSVG: buildOfficeSVG,
    getStatusMeta: getStatusMeta,
    VIEWBOXES: VIEWBOXES
  };
})(window);
