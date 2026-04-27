document.addEventListener('DOMContentLoaded', () => {
  const canvas = CanvasManager.init();
  Tools.init(canvas);

  // ── File load ──
  document.getElementById('file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) { e.target.value = ''; return; }
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg'))
      await CanvasManager.loadSVG(file);
    else
      await CanvasManager.loadImage(file);
    e.target.value = '';
  });

  document.getElementById('btn-load-json').addEventListener('click', () => {
    document.getElementById('json-input').click();
  });

  document.getElementById('json-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) await CanvasManager.loadJSON(file);
    e.target.value = '';
  });

  // ── Tool buttons ──
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tool = btn.dataset.tool;
      Tools.setTool(tool);
      _updateToolOpts(tool);
    });
  });

  // 도구 자동 복귀 이벤트 (텍스트/각도/호치수 배치 후 select로)
  document.addEventListener('tool:switch', (e) => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.tool-btn[data-tool="${e.detail}"]`);
    if (btn) btn.classList.add('active');
    _updateToolOpts(e.detail);
  });

  // ── Tool-Options Bar: 도구에 맞는 옵션만 표시 ──
  function _updateToolOpts(tool) {
    document.querySelectorAll('#tool-options-bar .topt, #tool-options-bar .topt-sep').forEach(el => {
      const tools = el.dataset.tools ? el.dataset.tools.split(',') : [];
      el.classList.toggle('hidden', !tools.includes(tool));
    });
  }
  // 초기 상태: select 도구
  _updateToolOpts('select');

  // ── Toast 알림 ──
  let _toastTimer = null;
  const _toastEl = document.getElementById('toast');
  document.addEventListener('ui:toast', (e) => {
    clearTimeout(_toastTimer);
    _toastEl.textContent = e.detail;
    _toastEl.classList.remove('hidden', 'toast-fade-out');
    _toastTimer = setTimeout(() => {
      _toastEl.classList.add('toast-fade-out');
      setTimeout(() => _toastEl.classList.add('hidden'), 260);
    }, 3000);
  });

  // ── Tool Rail 스크롤 힌트 ──
  const railEl = document.getElementById('tool-rail');
  const railHint = document.getElementById('rail-scroll-hint');
  function _updateRailHint() {
    const atBottom = railEl.scrollTop + railEl.clientHeight >= railEl.scrollHeight - 4;
    railHint.style.opacity = atBottom ? '0' : '1';
  }
  railEl.addEventListener('scroll', _updateRailHint, { passive: true });
  requestAnimationFrame(_updateRailHint);

  // ── eachLeaf: 단일/그룹/다중선택 처리 ──
  function eachLeaf(fn) {
    const active = canvas.getActiveObject();
    if (!active) return;
    const tops = active.type === 'activeSelection' ? active._objects : [active];
    tops.forEach(obj => {
      if (obj.type === 'group') {
        obj._objects.forEach(child => fn(child, obj));
        obj.set({ dirty: true });
      } else {
        fn(obj, null);
      }
    });
    canvas.renderAll();
  }

  // ── rgba 헬퍼 ──
  function _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ── Color ──
  document.getElementById('color-picker').addEventListener('input', (e) => {
    const c = e.target.value;
    Tools.setColor(c);
    eachLeaf((child) => {
      if (child.type === 'image') return;
      if (child.type === 'text' || child.type === 'i-text') child.set({ fill: c });
      else child.set({ stroke: c });
    });
    // Inspector 동기화 (Issue #3)
    document.getElementById('insp-stroke-color').value = c;
    CanvasManager.snapshot();
  });

  // ── Stroke width ──
  document.getElementById('stroke-width').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('stroke-width-val').textContent = val;
    Tools.setStrokeWidth(val);
    eachLeaf((child) => {
      if (child.type === 'image') return;
      if (child.type !== 'text' && child.type !== 'i-text') child.set({ strokeWidth: val });
    });
    CanvasManager.snapshot();
  });

  // ── Dash pattern ──
  document.getElementById('dash-pattern').addEventListener('change', (e) => {
    Tools.setDashPattern(e.target.value);
    const pattern = e.target.value.split(',').map(Number);
    eachLeaf((child) => {
      if (child.type === 'image') return;
      if (child.strokeDashArray) child.set({ strokeDashArray: pattern });
    });
  });

  // ── Opacity (채우기 투명도) ──
  document.getElementById('opacity-input').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('opacity-val').textContent = val + '%';
    Tools.setFillOpacity(val);
    const rgba = _hexToRgba(document.getElementById('fill-color').value, val / 100);
    eachLeaf((child) => {
      if (child.type === 'image' || child.type === 'text' || child.type === 'i-text') return;
      if (child.fill && child.fill !== '') child.set({ fill: rgba });
    });
    canvas.renderAll();
  });

  // ── 선·화살표·점 스타일 ──
  document.getElementById('line-style').addEventListener('change', (e) => Tools.setLineStyle(e.target.value));
  document.getElementById('arrow-style').addEventListener('change', (e) => Tools.setArrowStyle(e.target.value));
  document.getElementById('point-style').addEventListener('change', (e) => Tools.setPointStyle(e.target.value));

  // ── Label ──
  document.getElementById('label-current').addEventListener('change', (e) => {
    Tools.setCurrentLabel(e.target.value.trim() || 'A');
  });
  document.getElementById('label-current').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.target.blur();
  });
  document.getElementById('btn-label-reset').addEventListener('click', () => {
    Tools.setCurrentLabel('A');
  });

  // ── No-stroke (닫힌 도형 외곽선 없음) ──
  document.getElementById('no-stroke').addEventListener('change', (e) => {
    Tools.setStrokeEnabled(!e.target.checked);
    const colorRow = document.getElementById('insp-stroke-color-row');
    const widthRow = document.getElementById('insp-stroke-width-row');
    eachLeaf((child) => {
      if (child.type === 'image' || child.type === 'text' || child.type === 'i-text') return;
      child.set({ stroke: e.target.checked ? 'transparent' : document.getElementById('color-picker').value });
    });
    CanvasManager.snapshot();
  });

  // ── Fill (도구 기본값) ──
  document.getElementById('fill-enabled').addEventListener('change', (e) => {
    Tools.setShapeFillEnabled(e.target.checked);
  });
  document.getElementById('fill-color').addEventListener('input', (e) => {
    Tools.setShapeFillColor(e.target.value);
    const opacity = parseInt(document.getElementById('opacity-input').value) / 100;
    const rgba = _hexToRgba(e.target.value, opacity);
    eachLeaf((child) => {
      if (child.type === 'image' || child.type === 'text' || child.type === 'i-text') return;
      if (child.fill && child.fill !== '') child.set({ fill: rgba });
    });
    canvas.renderAll();
  });

  // ── Actions ──
  document.getElementById('btn-export').addEventListener('click', () => CanvasManager.exportPNG());
  document.getElementById('btn-export-svg').addEventListener('click', () => CanvasManager.exportSVG());
  document.getElementById('btn-save').addEventListener('click', () => CanvasManager.saveJSON());
  document.getElementById('btn-undo').addEventListener('click', () => CanvasManager.undo());
  document.getElementById('btn-redo').addEventListener('click', () => CanvasManager.redo());

  document.getElementById('btn-lock').addEventListener('click', () => {
    const locked = Tools.toggleLock();
    if (locked === undefined) return;
    document.getElementById('btn-lock').textContent = locked ? '🔓 해제' : '🔒 잠금';
    // Inspector 잠금 버튼도 동기화 (Issue #4)
    const inspLock = document.getElementById('insp-lock');
    inspLock.textContent = locked ? '🔓 해제' : '🔒 잠금';
    inspLock.style.borderColor = locked ? 'var(--yellow)' : '';
    inspLock.style.color = locked ? 'var(--yellow)' : '';
    CanvasManager.snapshot();
  });

  const _gridOverlay = document.getElementById('grid-overlay');
  document.getElementById('btn-grid-snap').addEventListener('click', () => {
    const on = Tools.toggleGridSnap();
    document.getElementById('btn-grid-snap').classList.toggle('active', on);
    _gridOverlay.classList.toggle('hidden', !on);
  });
  document.getElementById('grid-size-input').addEventListener('change', (e) => {
    const sz = Math.max(2, parseInt(e.target.value) || 10);
    Tools.setGridSize(sz);
    _gridOverlay.style.backgroundSize = `${sz}px ${sz}px`;
  });

  function deleteActive() {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    if (obj.type === 'activeSelection') {
      canvas.getActiveObjects().forEach(o => canvas.remove(o));
      canvas.discardActiveObject();
    } else {
      canvas.remove(obj);
    }
    canvas.renderAll();
  }

  document.getElementById('btn-delete').addEventListener('click', deleteActive);

  // ── Z-order ──
  document.getElementById('btn-bring-forward').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.bringForward(obj);
    canvas.renderAll();
    CanvasManager.snapshot();
  });
  document.getElementById('btn-send-backward').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.sendBackwards(obj);
    canvas.renderAll();
    CanvasManager.snapshot();
  });

  // ── 대칭 / 회전 ──
  function transformActive(fn) {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    fn(obj);
    obj.setCoords();
    canvas.renderAll();
    CanvasManager.snapshot();
  }

  document.getElementById('btn-flip-x').addEventListener('click', () => {
    transformActive(obj => obj.set({ flipX: !obj.flipX }));
  });
  document.getElementById('btn-flip-y').addEventListener('click', () => {
    transformActive(obj => obj.set({ flipY: !obj.flipY }));
  });
  document.getElementById('btn-rotate-ccw').addEventListener('click', () => {
    transformActive(obj => obj.set({ angle: ((obj.angle || 0) - 90 + 360) % 360 }));
  });
  document.getElementById('btn-rotate-cw').addEventListener('click', () => {
    transformActive(obj => obj.set({ angle: ((obj.angle || 0) + 90) % 360 }));
  });

  // ── Inspector Panel ──
  const _inspPanel  = document.getElementById('inspector-panel');
  const _inspEmpty  = document.getElementById('insp-empty');
  const _inspObj    = document.getElementById('insp-obj');
  const _main       = document.getElementById('main');

  // Inspector 열기/닫기
  document.getElementById('btn-inspector-toggle').addEventListener('click', () => {
    const hidden = _main.classList.toggle('inspector-hidden');
    document.getElementById('btn-inspector-toggle').classList.toggle('active', !hidden);
  });

  // 객체 타입 한글 이름
  const TYPE_NAMES = {
    'line': '선', 'path': '경로', 'ellipse': '타원', 'rect': '직사각형',
    'polygon': '다각형', 'circle': '원', 'image': '이미지', 'text': '텍스트',
    'i-text': '텍스트', 'group': '그룹',
  };
  const _TYPE_META = {
    'math-text': '수식', 'math-label': '레이블', 'bg-image': '배경 이미지',
    'axis': '좌표축', 'graph': '그래프', 'angle': '각도', 'arc-dim': '호치수',
    'projection': '수선의 발',
  };

  function _syncInspector(obj) {
    if (!obj || obj._isTempPreview) { _clearInspector(); return; }
    _inspEmpty.classList.add('hidden');
    _inspObj.classList.remove('hidden');

    // 타입 이름
    const metaName = obj._type ? _TYPE_META[obj._type] : null;
    const typeName = metaName || TYPE_NAMES[obj.type] || obj.type;
    document.getElementById('insp-type').textContent = typeName;

    // 위치
    document.getElementById('insp-x').textContent = Math.round(obj.left || 0);
    document.getElementById('insp-y').textContent = Math.round(obj.top  || 0);

    // 외곽선 (이미지 제외)
    const strokeSection = document.getElementById('insp-stroke-section');
    if (obj.type === 'image') {
      strokeSection.style.display = 'none';
    } else {
      strokeSection.style.display = '';
      const sc = obj.stroke || '#000000';
      const noStroke = !sc || sc === 'transparent';
      document.getElementById('insp-no-stroke').checked = noStroke;
      document.getElementById('insp-stroke-color-row').style.display = noStroke ? 'none' : '';
      document.getElementById('insp-stroke-width-row').style.display = noStroke ? 'none' : '';
      const scHex = noStroke ? '#000000' : _toHex(sc);
      document.getElementById('insp-stroke-color').value = scHex;
      document.getElementById('insp-stroke-width').value = obj.strokeWidth || 1;
      document.getElementById('insp-stroke-width-val').textContent = obj.strokeWidth || 1;
      // 툴바 동기화 (Issue #2/#3)
      if (!noStroke) {
        document.getElementById('color-picker').value = scHex;
        document.getElementById('stroke-width').value = obj.strokeWidth || 1;
        document.getElementById('stroke-width-val').textContent = obj.strokeWidth || 1;
      }
    }

    // 잠금 상태 (Issue #4)
    const locked = !!obj._locked;
    const inspLock = document.getElementById('insp-lock');
    inspLock.textContent = locked ? '🔓 해제' : '🔒 잠금';
    inspLock.style.borderColor = locked ? 'var(--yellow)' : '';
    inspLock.style.color = locked ? 'var(--yellow)' : '';

    // 채우기 (닫힌 도형)
    const fillSection = document.getElementById('insp-fill-section');
    const fillableTypes = ['ellipse', 'rect', 'polygon', 'path', 'circle'];
    if (fillableTypes.includes(obj.type)) {
      fillSection.style.display = '';
      const hasFill = obj.fill && obj.fill !== '';
      document.getElementById('insp-fill-enabled').checked = hasFill;
      if (hasFill) {
        const { hex, alpha } = _parseRgba(obj.fill);
        document.getElementById('insp-fill-color').value = hex;
        const pct = Math.round(alpha * 100);
        document.getElementById('insp-opacity').value = pct;
        document.getElementById('insp-opacity-val').textContent = pct + '%';
      }
    } else {
      fillSection.style.display = 'none';
    }
  }

  function _clearInspector() {
    _inspEmpty.classList.remove('hidden');
    _inspObj.classList.add('hidden');
  }

  // hex → rgb 변환 (Inspector 색상 피커용)
  function _toHex(color) {
    if (!color || color === 'transparent') return '#000000';
    if (color.startsWith('#')) return color.slice(0, 7);
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return '#000000';
    return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  }

  function _parseRgba(color) {
    if (!color) return { hex: '#aaaaaa', alpha: 0.3 };
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (m) {
      const hex = '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
      return { hex, alpha: m[4] !== undefined ? parseFloat(m[4]) : 1 };
    }
    if (color.startsWith('#')) return { hex: color.slice(0, 7), alpha: 1 };
    return { hex: '#aaaaaa', alpha: 0.3 };
  }

  // Fabric 선택 이벤트
  canvas.on('selection:created', (e) => _syncInspector(e.selected?.[0] || canvas.getActiveObject()));
  canvas.on('selection:updated', (e) => _syncInspector(e.selected?.[0] || canvas.getActiveObject()));
  canvas.on('selection:cleared', () => _clearInspector());
  canvas.on('object:modified', () => {
    const obj = canvas.getActiveObject();
    if (obj) _syncInspector(obj);
  });

  // Inspector 외곽선 없음
  document.getElementById('insp-no-stroke').addEventListener('change', (e) => {
    const hide = e.target.checked;
    document.getElementById('insp-stroke-color-row').style.display = hide ? 'none' : '';
    document.getElementById('insp-stroke-width-row').style.display = hide ? 'none' : '';
    const strokeVal = hide ? 'transparent' : document.getElementById('insp-stroke-color').value;
    eachLeaf((child) => {
      if (child.type === 'image' || child.type === 'text' || child.type === 'i-text') return;
      child.set({ stroke: strokeVal });
    });
    CanvasManager.snapshot();
  });

  // Inspector 색상 변경
  document.getElementById('insp-stroke-color').addEventListener('input', (e) => {
    const c = e.target.value;
    eachLeaf((child) => {
      if (child.type === 'image') return;
      if (child.type === 'text' || child.type === 'i-text') child.set({ fill: c });
      else child.set({ stroke: c });
    });
    // 툴바 동기화 (Issue #3)
    document.getElementById('color-picker').value = c;
    Tools.setColor(c);
    CanvasManager.snapshot();
  });

  document.getElementById('insp-stroke-width').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('insp-stroke-width-val').textContent = val;
    eachLeaf((child) => {
      if (child.type === 'image') return;
      if (child.type !== 'text' && child.type !== 'i-text') child.set({ strokeWidth: val });
    });
    CanvasManager.snapshot();
  });

  document.getElementById('insp-fill-enabled').addEventListener('change', (e) => {
    const active = canvas.getActiveObject();
    if (!active) return;
    if (e.target.checked) {
      const fc  = document.getElementById('insp-fill-color').value;
      const pct = parseInt(document.getElementById('insp-opacity').value) / 100;
      eachLeaf((child) => {
        if (child.type === 'image' || child.type === 'text' || child.type === 'i-text') return;
        child.set({ fill: _hexToRgba(fc, pct) });
      });
    } else {
      eachLeaf((child) => {
        if (child.type !== 'image') child.set({ fill: '' });
      });
    }
    CanvasManager.snapshot();
  });

  document.getElementById('insp-fill-color').addEventListener('input', (e) => {
    const pct = parseInt(document.getElementById('insp-opacity').value) / 100;
    const rgba = _hexToRgba(e.target.value, pct);
    eachLeaf((child) => {
      if (child.type === 'image' || child.type === 'text' || child.type === 'i-text') return;
      if (child.fill && child.fill !== '') child.set({ fill: rgba });
    });
    canvas.renderAll();
  });

  document.getElementById('insp-opacity').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('insp-opacity-val').textContent = val + '%';
    const fc = document.getElementById('insp-fill-color').value;
    const rgba = _hexToRgba(fc, val / 100);
    eachLeaf((child) => {
      if (child.type === 'image' || child.type === 'text' || child.type === 'i-text') return;
      if (child.fill && child.fill !== '') child.set({ fill: rgba });
    });
    canvas.renderAll();
  });

  // Inspector 레이어 버튼
  document.getElementById('insp-bring-fwd').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.bringForward(obj);
    canvas.renderAll();
    CanvasManager.snapshot();
  });
  document.getElementById('insp-send-back').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.sendBackwards(obj);
    canvas.renderAll();
    CanvasManager.snapshot();
  });

  // Inspector 잠금 (Issue #4)
  document.getElementById('insp-lock').addEventListener('click', () => {
    const locked = Tools.toggleLock();
    if (locked === undefined) return;
    const btn = document.getElementById('insp-lock');
    btn.textContent = locked ? '🔓 해제' : '🔒 잠금';
    btn.style.borderColor = locked ? 'var(--yellow)' : '';
    btn.style.color = locked ? 'var(--yellow)' : '';
    // 상단 잠금 버튼도 동기화
    document.getElementById('btn-lock').textContent = locked ? '🔓 해제' : '🔒 잠금';
    CanvasManager.snapshot();
  });

  // Inspector 삭제
  document.getElementById('insp-delete').addEventListener('click', deleteActive);

  // ── Shortcut overlay ──
  document.getElementById('shortcut-close').addEventListener('click', () => {
    document.getElementById('shortcut-modal').classList.add('hidden');
  });

  // ── Graph modal ──
  const _graphFnSelect = document.getElementById('graph-fn-type');
  Tools.GRAPH_FN_DEFS.forEach(def => {
    const opt = document.createElement('option');
    opt.value = def.key;
    opt.textContent = def.label;
    _graphFnSelect.appendChild(opt);
  });

  function _updateGraphParamsArea(fnKey) {
    const def       = Tools.GRAPH_FN_DEFS.find(d => d.key === fnKey);
    const area      = document.getElementById('graph-params-area');
    const customRow = document.getElementById('graph-custom-row');
    area.innerHTML  = '';
    // 삼차함수 극값 섹션 토글
    document.getElementById('cubic-extrema-area').classList.toggle('hidden', fnKey !== 'cubic');
    document.getElementById('cubic-inflection-row').style.display = 'none';
    if (!def || !def.build) { customRow.classList.remove('hidden'); return; }
    customRow.classList.add('hidden');
    const row = document.createElement('div');
    row.className = 'modal-row';
    row.style.flexWrap = 'wrap';
    row.style.gap = '6px';
    def.params.forEach(({k, v, s}) => {
      const lbl = document.createElement('label');
      lbl.textContent = k + ' =';
      lbl.style.cssText = 'white-space:nowrap;margin-right:2px';
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'graph-param';
      inp.dataset.key = k;
      inp.value = v;
      inp.step = s;
      inp.style.width = '52px';
      row.appendChild(lbl);
      row.appendChild(inp);
    });
    area.appendChild(row);
  }

  // ── 삼차함수 극값 → 계수 계산 ──
  function _cubicFromExtrema() {
    const x1 = parseFloat(document.getElementById('cubic-max-x').value);
    const y1 = parseFloat(document.getElementById('cubic-max-y').value);
    const x2 = parseFloat(document.getElementById('cubic-min-x').value);
    const y2 = parseFloat(document.getElementById('cubic-min-y').value);
    if ([x1, y1, x2, y2].some(isNaN) || Math.abs(x1 - x2) < 0.001) return null;

    const dx = x1 - x2;
    const a  = 2 * (y2 - y1) / (dx * dx * dx);
    const b  = -1.5 * a * (x1 + x2);
    const c  = 3 * a * x1 * x2;
    const d  = y1 - a * x1 ** 3 - b * x1 ** 2 - c * x1;
    return { a, b, c, d, x1, y1, x2, y2 };
  }

  function _setCubicParams(coeffs) {
    document.querySelectorAll('#graph-params-area .graph-param').forEach(inp => {
      const k = inp.dataset.key;
      if (k in coeffs) inp.value = parseFloat(coeffs[k].toFixed(4));
    });
    _updateGraphPreview();
  }

  document.getElementById('cubic-calc-btn').addEventListener('click', () => {
    const r = _cubicFromExtrema();
    if (!r) {
      document.dispatchEvent(new CustomEvent('ui:toast', { detail: '극대·극소 좌표를 모두 입력하세요.' }));
      return;
    }
    _setCubicParams(r);
    // 변곡점 표시
    const ix = (r.x1 + r.x2) / 2;
    const iy = r.a * ix ** 3 + r.b * ix ** 2 + r.c * ix + r.d;
    document.getElementById('cubic-inflection-display').textContent =
      `(${parseFloat(ix.toFixed(3))}, ${parseFloat(iy.toFixed(3))})`;
    document.getElementById('cubic-inflection-row').style.display = '';
  });

  document.getElementById('cubic-autofit-btn').addEventListener('click', () => {
    const r = _cubicFromExtrema();
    if (!r) {
      document.dispatchEvent(new CustomEvent('ui:toast', { detail: '극대·극소 좌표를 모두 입력하세요.' }));
      return;
    }
    _setCubicParams(r);

    // x 범위: 극값 간격의 0.7배 여백
    const margin = Math.abs(r.x2 - r.x1) * 0.7;
    const xMin = Math.min(r.x1, r.x2) - margin;
    const xMax = Math.max(r.x1, r.x2) + margin;
    document.getElementById('graph-xmin').value = parseFloat(xMin.toFixed(2));
    document.getElementById('graph-xmax').value = parseFloat(xMax.toFixed(2));

    // y 범위 샘플링 → y 비율 자동 설정
    const steps = 200;
    let yMin = Infinity, yMax = -Infinity;
    for (let i = 0; i <= steps; i++) {
      const x = xMin + (xMax - xMin) * i / steps;
      const y = r.a * x ** 3 + r.b * x ** 2 + r.c * x + r.d;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
    const yRange = yMax - yMin || 1;
    const targetPx = 260; // 캔버스 높이의 ~70%에 해당하는 픽셀
    const yscale = Math.round(Math.max(1, Math.min(500, targetPx / yRange)));
    document.getElementById('graph-yscale').value = yscale;

    // x 비율도 동일하게
    const xRange = xMax - xMin || 1;
    const xscale = Math.round(Math.max(1, Math.min(500, targetPx / xRange)));
    document.getElementById('graph-scale').value = xscale;

    // 변곡점 표시
    const ix = (r.x1 + r.x2) / 2;
    const iy = r.a * ix ** 3 + r.b * ix ** 2 + r.c * ix + r.d;
    document.getElementById('cubic-inflection-display').textContent =
      `(${parseFloat(ix.toFixed(3))}, ${parseFloat(iy.toFixed(3))})`;
    document.getElementById('cubic-inflection-row').style.display = '';
  });

  function _updateGraphPreview() {
    const fnKey   = _graphFnSelect.value;
    const def     = Tools.GRAPH_FN_DEFS.find(d => d.key === fnKey);
    const preview = document.getElementById('graph-expr-preview');
    if (!def || !def.display) {
      const expr = document.getElementById('graph-expr').value.trim();
      preview.textContent = expr ? `y = ${expr}` : '';
      return;
    }
    const p = {};
    document.querySelectorAll('#graph-params-area .graph-param').forEach(inp => {
      p[inp.dataset.key] = parseFloat(inp.value);
      if (isNaN(p[inp.dataset.key])) p[inp.dataset.key] = 0;
    });
    preview.textContent = def.display(p);
  }

  _graphFnSelect.addEventListener('change', (e) => {
    _updateGraphParamsArea(e.target.value);
    _updateGraphPreview();
  });
  document.getElementById('graph-params-area').addEventListener('input', (e) => {
    if (e.target.classList.contains('graph-param')) _updateGraphPreview();
  });
  document.getElementById('graph-params-area').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') Tools.confirmGraph();
    if (e.key === 'Escape') Tools.cancelGraph();
  });
  document.getElementById('graph-expr').addEventListener('input', _updateGraphPreview);
  _updateGraphParamsArea(_graphFnSelect.value);
  _updateGraphPreview();

  document.getElementById('graph-ok').addEventListener('click', () => Tools.confirmGraph());
  document.getElementById('graph-cancel').addEventListener('click', () => Tools.cancelGraph());
  document.getElementById('graph-expr').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') Tools.confirmGraph();
    if (e.key === 'Escape') Tools.cancelGraph();
  });

  // ── Axis ratio modal ──
  document.getElementById('axis-ratio-ok').addEventListener('click', () => Tools.confirmAxisRatio());
  document.getElementById('axis-ratio-cancel').addEventListener('click', () => Tools.cancelAxisRatio());
  ['axis-x-len', 'axis-y-len'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') Tools.confirmAxisRatio();
      if (e.key === 'Escape') Tools.cancelAxisRatio();
    });
  });

  // ── Text modal ──
  document.getElementById('text-ok').addEventListener('click', () => Tools.confirmText());
  document.getElementById('text-cancel').addEventListener('click', () => Tools.cancelText());
  document.getElementById('text-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') Tools.confirmText();
    if (e.key === 'Escape') Tools.cancelText();
  });

  // ── Angle modal ──
  document.getElementById('angle-font-size-input').addEventListener('input', (e) => {
    document.getElementById('angle-font-size-val').textContent = e.target.value;
    Tools.setFontSize(e.target.value);
  });
  document.getElementById('angle-ok').addEventListener('click', () => Tools.confirmAngle());
  document.getElementById('angle-cancel').addEventListener('click', () => Tools.cancelAngle());
  document.getElementById('angle-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') Tools.confirmAngle();
    if (e.key === 'Escape') Tools.cancelAngle();
  });

  // ── Font size (text modal) ──
  document.getElementById('font-size-input').addEventListener('input', (e) => {
    document.getElementById('font-size-val').textContent = e.target.value;
    Tools.setFontSize(e.target.value);
  });

  // ── Copy / Paste ──
  let _clipboard = null;
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      const active = canvas.getActiveObject();
      if (!active) return;
      active.clone((cloned) => { _clipboard = cloned; },
        ['_type', '_latex', '_axisData']);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      if (!_clipboard) return;
      _clipboard.clone((cloned) => {
        canvas.discardActiveObject();
        cloned.set({ left: (_clipboard.left || 0) + 20, top: (_clipboard.top || 0) + 20, evented: true });
        if (cloned.type === 'activeSelection') {
          cloned.canvas = canvas;
          cloned.forEachObject(obj => canvas.add(obj));
          cloned.setCoords();
        } else {
          canvas.add(cloned);
        }
        canvas.setActiveObject(cloned);
        canvas.requestRenderAll();
        _clipboard = cloned;
      }, ['_type', '_latex', '_axisData']);
      return;
    }
  });

  // ── Keyboard shortcuts ──
  document.addEventListener('keydown', (e) => {
    const inInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (inInput) return;

    if (e.key === '?') {
      document.getElementById('shortcut-modal').classList.toggle('hidden');
      return;
    }

    const toolMap = {
      v: 'select', l: 'line', t: 'text', g: 'angle', f: 'bucket',
      r: 'arc-dim', x: 'axis', e: 'graph', o: 'circle', s: 'rect',
      p: 'projection', n: 'polygon', a: 'arc', q: 'label',
    };
    const key = e.key.toLowerCase();
    if (toolMap[key] && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const btn = document.querySelector(`.tool-btn[data-tool="${toolMap[key]}"]`);
      if (btn) btn.click();
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteActive();
    }

    // 화살표 키 이동
    const arrowMap = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrowMap[e.key] && Tools.getCurrentTool() === 'select') {
      e.preventDefault();
      const active = canvas.getActiveObject();
      if (!active) return;
      const step = e.shiftKey ? 10 : 1;
      const [dx, dy] = arrowMap[e.key];
      active.set({ left: active.left + dx * step, top: active.top + dy * step });
      active.setCoords();
      canvas.renderAll();
    }

    if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault();
      CanvasManager.undo();
    }
    if ((e.key === 'z' && e.shiftKey && (e.ctrlKey || e.metaKey)) ||
        (e.key === 'y' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      CanvasManager.redo();
    }

    if (e.key === 'Enter' && Tools.getCurrentTool() === 'polygon') {
      e.preventDefault();
      Tools.confirmPolygon();
      return;
    }
    if (e.key === 'Enter' && Tools.getCurrentTool() === 'arc') {
      e.preventDefault();
      Tools.cancelArc();
      return;
    }

    if (e.key === 'Escape') {
      Tools.cancelText();
      Tools.cancelAngle();
      Tools.cancelAxisRatio();
      Tools.cancelGraph();
      Tools.cancelPolygon();
      Tools.cancelArc();
      document.getElementById('shortcut-modal').classList.add('hidden');
    }
  });

  // ── Drag & drop ──
  document.getElementById('canvas-container').addEventListener('dragover', (e) => e.preventDefault());
  document.getElementById('canvas-container').addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg'))
      await CanvasManager.loadSVG(file);
    else if (file.type.startsWith('image/')) await CanvasManager.loadImage(file);
    else if (file.name.endsWith('.json')) await CanvasManager.loadJSON(file);
  });
});
