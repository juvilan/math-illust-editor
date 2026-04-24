const CanvasManager = (() => {
  let canvas = null;
  let history = [];
  let redoStack = [];
  let historyLock = false;

  const CUSTOM_PROPS = ['_isTempPreview', '_type', '_latex', '_axisData', '_locked', '_graphExpr', '_graphXMin', '_graphXMax', '_graphScale', '_graphYScale', '_graphOriginX', '_graphOriginY', '_graphXDirX', '_graphXDirY', '_graphFnKey', '_graphParams'];

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
    canvas.setWidth(800);
    canvas.setHeight(600);

    canvas.on('object:added', _onModified);
    canvas.on('object:modified', _onModified);
    canvas.on('object:removed', _onModified);

    return canvas;
  }

  function _onModified() {
    if (historyLock) return;
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
        const url = e.target.result; // data URL → SVG export에 배경 embed 가능
        _loadImageFromURL(url, resolve);
      };
      reader.readAsDataURL(file);
    });
  }

  function _loadImageFromURL(url, resolve) {
    fabric.Image.fromURL(url, (img) => {
      const maxW = window.innerWidth - 80;
      const maxH = window.innerHeight - 60;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);

      canvas.setWidth(Math.round(img.width * scale));
      canvas.setHeight(Math.round(img.height * scale));

      img.set({ scaleX: scale, scaleY: scale, left: 0, top: 0,
        selectable: false, evented: false, originX: 'left', originY: 'top' });

      canvas.clear();
      canvas.setBackgroundImage(img, () => {
        canvas.renderAll();
        history = [];
        redoStack = [];
        _onModified();
        resolve();
      });
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

  function loadJSON(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        historyLock = true;
        canvas.loadFromJSON(JSON.parse(e.target.result), () => {
          canvas.renderAll();
          historyLock = false;
          resolve();
        });
      };
      reader.readAsText(file);
    });
  }

  function undo() {
    if (history.length < 2) return;
    redoStack.push(history.pop());
    historyLock = true;
    canvas.loadFromJSON(JSON.parse(history[history.length - 1]), () => {
      canvas.renderAll();
      historyLock = false;
    });
  }

  function redo() {
    if (redoStack.length === 0) return;
    const state = redoStack.pop();
    history.push(state);
    historyLock = true;
    canvas.loadFromJSON(JSON.parse(state), () => {
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

  function exportSVG() {
    const svg = canvas.toSVG();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.download = `math-illust-${Date.now()}.svg`;
    a.href = URL.createObjectURL(blob);
    a.click();
  }

  function saveJSON() {
    const json = JSON.stringify(canvas.toJSON(CUSTOM_PROPS));
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.download = `math-illust-${Date.now()}.json`;
    a.href = URL.createObjectURL(blob);
    a.click();
  }

  function getCanvas() { return canvas; }

  return { init, loadImage, loadSVG, loadJSON, undo, redo, exportPNG, exportSVG, saveJSON, getCanvas, snapshot };
})();
