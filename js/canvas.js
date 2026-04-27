const CanvasManager = (() => {
  let canvas = null;
  let history = [];
  let redoStack = [];
  let historyLock = false;

  const CUSTOM_PROPS = ['_type', '_latex', '_axisData', '_locked', '_graphExpr', '_graphXMin', '_graphXMax', '_graphScale', '_graphYScale', '_graphOriginX', '_graphOriginY', '_graphXDirX', '_graphXDirY', '_graphFnKey', '_graphParams'];

  let _snapshotTimer = null;
  function snapshot() {
    clearTimeout(_snapshotTimer);
    _snapshotTimer = setTimeout(_onModified, 500);
  }

  function init() {
    canvas = new fabric.Canvas('main-canvas', {
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
    });
    const style = getComputedStyle(document.documentElement);
    const railW = parseInt(style.getPropertyValue('--rail-w'))     || 100;
    const inspW = parseInt(style.getPropertyValue('--insp-w'))     || 268;
    const topH  = parseInt(style.getPropertyValue('--top-bar-h'))  || 56;
    const optsH = parseInt(style.getPropertyValue('--opts-bar-h')) || 50;
    canvas.setWidth( Math.max(900,  window.innerWidth  - railW - inspW - 4));
    canvas.setHeight(Math.max(680,  window.innerHeight - topH  - optsH - 4));

    canvas.on('object:added',    _onModifiedFiltered);
    canvas.on('object:modified', _onModifiedFiltered);
    canvas.on('object:removed',  _onModifiedFiltered);

    _onModified(); // 초기 빈 캔버스 상태를 history에 시딩 (첫 객체 undo 가능하게)
    return canvas;
  }

  // _isTempPreview 객체는 히스토리에 기록하지 않음 (M-1)
  function _onModifiedFiltered(e) {
    if (e && e.target && e.target._isTempPreview) return;
    _onModified();
  }

  function _onModified() {
    if (historyLock) return;
    // 저장 시 미리보기 객체 제외 (M-1)
    const json = JSON.stringify(canvas.toJSON(CUSTOM_PROPS));
    if (history.length && history[history.length - 1] === json) return;
    history.push(json);
    redoStack = [];
    if (history.length > 40) history.shift();
  }

  function loadImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        _loadImageFromURL(e.target.result, resolve);
      };
      reader.readAsDataURL(file);
    });
  }

  function _loadImageFromURL(url, resolve) {
    fabric.Image.fromURL(url, (img) => {
      const maxW = canvas.width  - 80;
      const maxH = canvas.height - 80;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);

      img.set({ scaleX: scale, scaleY: scale, left: 0, top: 0,
        originX: 'left', originY: 'top',
        _type: 'bg-image',
      });

      canvas.clear();
      canvas.add(img);
      canvas.sendToBack(img);
      canvas.renderAll();
      history = [];
      redoStack = [];
      _onModified();
      resolve();
    });
  }

  function loadSVG(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      fabric.loadSVGFromURL(url, (objects, options) => {
        URL.revokeObjectURL(url);
        if (!objects || objects.length === 0) { resolve(); return; }
        const svg = fabric.util.groupSVGElements(objects, options);
        const w = svg.width  || svg.getScaledWidth()  || 100;
        const h = svg.height || svg.getScaledHeight() || 100;
        const scale = Math.min((canvas.width * 0.9) / w, (canvas.height * 0.9) / h, 1);
        svg.set({
          scaleX: scale, scaleY: scale,
          left: canvas.width  / 2,
          top:  canvas.height / 2,
          originX: 'center', originY: 'center',
        });
        canvas.add(svg);
        canvas.renderAll();
        resolve();
      });
    });
  }

  // H-3: loadJSON 후 히스토리 초기화 / M-6: try/catch로 historyLock 고착 방지
  function loadJSON(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        let parsed;
        try {
          parsed = JSON.parse(e.target.result);
        } catch (_) {
          resolve();
          return;
        }
        historyLock = true;
        canvas.loadFromJSON(parsed, () => {
          canvas.renderAll();
          historyLock = false;
          history = [];
          redoStack = [];
          _onModified();
          resolve();
        });
      };
      reader.readAsText(file);
    });
  }

  function undo() {
    if (history.length < 2) return;
    canvas.discardActiveObject();
    redoStack.push(history.pop());
    historyLock = true;
    canvas.loadFromJSON(JSON.parse(history[history.length - 1]), () => {
      canvas.discardActiveObject();
      canvas.renderAll();
      historyLock = false;
    });
  }

  function redo() {
    if (redoStack.length === 0) return;
    canvas.discardActiveObject();
    const state = redoStack.pop();
    history.push(state);
    historyLock = true;
    canvas.loadFromJSON(JSON.parse(state), () => {
      canvas.discardActiveObject();
      canvas.renderAll();
      historyLock = false;
    });
  }

  function exportPNG() {
    const dataURL = canvas.toDataURL({ format: 'png', multiplier: 2 });
    const a = document.createElement('a');
    a.download = `math-illust-${Date.now()}.png`;
    a.href = dataURL;
    a.click();
  }

  // L-4: blob URL 해제
  function exportSVG() {
    const svg = canvas.toSVG();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `math-illust-${Date.now()}.svg`;
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // M-1: 미리보기 객체 제외하고 저장 / L-4: blob URL 해제
  function saveJSON() {
    // 임시 프리뷰 객체를 저장에서 제외
    const allObjects = canvas.getObjects();
    const previews = allObjects.filter(o => o._isTempPreview);
    previews.forEach(o => canvas.remove(o));

    const json = JSON.stringify(canvas.toJSON(CUSTOM_PROPS));

    previews.forEach(o => canvas.add(o));

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `math-illust-${Date.now()}.json`;
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function getCanvas() { return canvas; }
  function setHistoryLock(v) { historyLock = v; }

  return { init, loadImage, loadSVG, loadJSON, undo, redo, exportPNG, exportSVG, saveJSON, getCanvas, snapshot, setHistoryLock };
})();
