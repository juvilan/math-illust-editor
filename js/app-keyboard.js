function initKeyboard(canvas) {
  let _clipboard = null;

  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      const active = canvas.getActiveObject();
      if (!active) return;
      active.clone((cloned) => { _clipboard = cloned; },
        ['_type', '_latex', '_axisData', '_labelMode', '_labelValue', '_fontSize']);
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
      }, ['_type', '_latex', '_axisData', '_labelMode', '_labelValue', '_fontSize']);
      return;
    }
  });

  document.addEventListener('keydown', (e) => {
    const inInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (inInput) return;

    if (e.key === '?') {
      document.getElementById('shortcut-modal').classList.toggle('hidden');
      return;
    }

    const toolMap = {
      v: 'select', l: 'line', t: 'text', m: 'formula', g: 'angle', f: 'bucket',
      r: 'arc-dim', x: 'axis', e: 'graph', o: 'circle', s: 'rect',
      p: 'projection', n: 'polygon', a: 'arc', q: 'label', w: 'cover',
    };
    const key = e.key.toLowerCase();
    if (toolMap[key] && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const btn = document.querySelector(`.tool-btn[data-tool="${toolMap[key]}"]`);
      if (btn) btn.click();
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      AppCtx.deleteActive();
    }

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

    if (e.key === 'g' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault();
      AppCtx.groupSelection();
    }
    if (e.key === 'g' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      e.preventDefault();
      AppCtx.ungroupSelection();
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
      if (AppCtx.eyedropperActive) {
        AppCtx.eyedropperActive = false;
        canvas.lowerCanvasEl.removeEventListener('mousedown', AppCtx.handleEyedropperClick, { capture: true });
        document.getElementById('cover-eyedropper-btn').style.outline = '';
      }
      Tools.cancelText();
      Tools.cancelAngle();
      Tools.cancelAxisRatio();
      Tools.cancelGraph();
      Tools.cancelPolygon();
      Tools.cancelArc();
      document.getElementById('shortcut-modal').classList.add('hidden');
    }
  });

  document.getElementById('shortcut-close').addEventListener('click', () => {
    document.getElementById('shortcut-modal').classList.add('hidden');
  });
}
