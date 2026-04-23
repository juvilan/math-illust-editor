document.addEventListener('DOMContentLoaded', () => {
  const canvas = CanvasManager.init();
  Tools.init(canvas);
  CloneTool.init(canvas);

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
      const prev = Tools.getCurrentTool();
      if (prev === 'clone') CloneTool.deactivate();
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const next = btn.dataset.tool;
      Tools.setTool(next);
      if (next === 'clone') {
        CloneTool.activate();
        document.getElementById('clone-hint').classList.remove('hidden');
      } else {
        document.getElementById('clone-hint').classList.add('hidden');
      }
    });
  });

  // 도구 자동 복귀 이벤트 (텍스트/각도/호치수 배치 후 select로)
  document.addEventListener('tool:switch', (e) => {
    if (Tools.getCurrentTool() === 'clone') CloneTool.deactivate();
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.tool-btn[data-tool="${e.detail}"]`);
    if (btn) btn.classList.add('active');
  });

  // ── Clone brush size ──
  document.getElementById('clone-brush').addEventListener('input', (e) => {
    document.getElementById('clone-brush-val').textContent = e.target.value;
    CloneTool.setBrushSize(e.target.value);
  });

  // 단일/그룹/다중선택 모두 처리하는 헬퍼
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

  // ── Color ──
  document.getElementById('color-picker').addEventListener('input', (e) => {
    const c = e.target.value;
    Tools.setColor(c);
    eachLeaf((child) => {
      if (child.type === 'image') return; // math-text/label은 SVG가 색 고정 — 건너뜀
      if (child.type === 'text' || child.type === 'i-text') child.set({ fill: c });
      else child.set({ stroke: c, fill: c });
    });
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

  // ── Opacity (영역 채우기에 반영) ──
  document.getElementById('opacity-input').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('opacity-val').textContent = val + '%';
    Tools.setFillOpacity(val);
    const active = canvas.getActiveObject();
    if (active && active.type === 'polygon') {
      active.set({ opacity: val / 100 });
      canvas.renderAll();
    }
  });

  // ── Actions ──
  document.getElementById('btn-export').addEventListener('click', () => CanvasManager.exportPNG());
  document.getElementById('btn-export-svg').addEventListener('click', () => CanvasManager.exportSVG());
  document.getElementById('btn-save').addEventListener('click', () => CanvasManager.saveJSON());
  document.getElementById('btn-undo').addEventListener('click', () => CanvasManager.undo());
  document.getElementById('btn-redo').addEventListener('click', () => CanvasManager.redo());

  document.getElementById('btn-lock').addEventListener('click', () => {
    const locked = Tools.toggleLock();
    document.getElementById('btn-lock').textContent = locked ? '🔓 잠금해제' : '🔒 잠금';
  });

  document.getElementById('btn-grid-snap').addEventListener('click', () => {
    const on = Tools.toggleGridSnap();
    document.getElementById('btn-grid-snap').classList.toggle('active', on);
  });
  document.getElementById('grid-size-input').addEventListener('change', (e) => {
    Tools.setGridSize(e.target.value);
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

  // ── Shortcut overlay ──
  document.getElementById('shortcut-close').addEventListener('click', () => {
    document.getElementById('shortcut-modal').classList.add('hidden');
  });

  // ── Axis ratio modal ──
  document.getElementById('axis-ratio-ok').addEventListener('click', () => Tools.confirmAxisRatio());
  document.getElementById('axis-ratio-cancel').addEventListener('click', () => Tools.cancelAxisRatio());

  document.getElementById('axis-x-len').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') Tools.confirmAxisRatio();
    if (e.key === 'Escape') Tools.cancelAxisRatio();
  });
  document.getElementById('axis-y-len').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') Tools.confirmAxisRatio();
    if (e.key === 'Escape') Tools.cancelAxisRatio();
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

  // ── Font size (in text modal) ──
  document.getElementById('font-size-input').addEventListener('input', (e) => {
    document.getElementById('font-size-val').textContent = e.target.value;
    Tools.setFontSize(e.target.value);
  });

  // ── Copy / Paste ──
  let _clipboard = null;

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      const active = canvas.getActiveObject();
      if (!active) return;
      active.clone((cloned) => { _clipboard = cloned; },
        ['_type', '_latex', '_axisData', '_isTempPreview']);
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
      }, ['_type', '_latex', '_axisData', '_isTempPreview']);
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

    const toolMap = { v: 'select', l: 'line', d: 'dashed-line', a: 'arrow', t: 'text', g: 'angle', f: 'bucket', r: 'arc-dim', x: 'axis', p: 'projection', c: 'clone' };
    const key = e.key.toLowerCase();

    if (toolMap[key] && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const btn = document.querySelector(`.tool-btn[data-tool="${toolMap[key]}"]`);
      if (btn) btn.click();
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteActive();
    }

    // 화살표 키 — 선택 객체 이동 (Shift: 10px, 기본: 1px)
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

    if (e.key === 'Escape') {
      Tools.cancelText();
      Tools.cancelAngle();
      Tools.cancelAxisRatio();
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
