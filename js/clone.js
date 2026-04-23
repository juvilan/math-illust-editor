const CloneTool = (() => {
  let fabricCanvas = null;
  let overlay = null;
  let overlayCtx = null;
  let sourceSet = false;
  let sourcePt = { x: 0, y: 0 };
  let painting = false;
  let brushSize = 20;
  let baking = false;

  function init(fc) {
    fabricCanvas = fc;
    overlay = document.getElementById('clone-overlay');
    overlayCtx = overlay.getContext('2d');
  }

  function activate() {
    const w = fabricCanvas.width;
    const h = fabricCanvas.height;
    overlay.width  = w;
    overlay.height = h;
    overlay.style.width  = w + 'px';
    overlay.style.height = h + 'px';
    overlay.style.display = 'block';
    document.getElementById('clone-brush-wrap').style.display = 'flex';
    overlay.addEventListener('mousedown', onDown);
    overlay.addEventListener('mousemove', onMove);
    overlay.addEventListener('mouseup',   onUp);
  }

  function deactivate() {
    overlay.style.display = 'none';
    document.getElementById('clone-brush-wrap').style.display = 'none';
    overlay.removeEventListener('mousedown', onDown);
    overlay.removeEventListener('mousemove', onMove);
    overlay.removeEventListener('mouseup',   onUp);
    sourceSet = false;
    painting  = false;
  }

  function setBrushSize(v) { brushSize = Math.max(2, parseInt(v) || 20); }

  function onDown(e) {
    if (e.altKey) {
      const r = overlay.getBoundingClientRect();
      sourcePt = { x: e.clientX - r.left, y: e.clientY - r.top };
      sourceSet = true;
      overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
      drawCrosshair(sourcePt);
      return;
    }
    if (e.button === 2) return;
    if (!sourceSet) return;
    painting = true;
    paint(getPos(e));
  }

  function onMove(e) {
    if (!painting) return;
    paint(getPos(e));
  }

  function onUp() {
    if (!painting) return;
    painting = false;
    scheduleBake();
  }

  function getPos(e) {
    const r = overlay.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function paint(dst) {
    const bgImg = fabricCanvas.backgroundImage;
    if (!bgImg) return;

    const el = bgImg.getElement();
    const cw = fabricCanvas.width;
    const ch = fabricCanvas.height;

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = cw; tmpCanvas.height = ch;
    const tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.drawImage(
      el, 0, 0, el.naturalWidth, el.naturalHeight,
      bgImg.left || 0, bgImg.top || 0,
      el.naturalWidth  * (bgImg.scaleX || 1),
      el.naturalHeight * (bgImg.scaleY || 1)
    );

    const dx = dst.x - sourcePt.x;
    const dy = dst.y - sourcePt.y;
    const r  = brushSize;

    overlayCtx.save();
    overlayCtx.beginPath();
    overlayCtx.arc(dst.x, dst.y, r, 0, Math.PI * 2);
    overlayCtx.clip();
    overlayCtx.drawImage(tmpCanvas, dx, dy);
    overlayCtx.restore();

    drawCrosshair(sourcePt);
  }

  function drawCrosshair(pt) {
    const sz = 10;
    overlayCtx.save();
    overlayCtx.strokeStyle = 'rgba(255,80,0,0.85)';
    overlayCtx.lineWidth = 1.5;
    overlayCtx.beginPath();
    overlayCtx.moveTo(pt.x - sz, pt.y); overlayCtx.lineTo(pt.x + sz, pt.y);
    overlayCtx.moveTo(pt.x, pt.y - sz); overlayCtx.lineTo(pt.x, pt.y + sz);
    overlayCtx.stroke();
    overlayCtx.restore();
  }

  let _bakeTimer = null;
  function scheduleBake() {
    clearTimeout(_bakeTimer);
    _bakeTimer = setTimeout(bake, 500);
  }

  function bake() {
    if (baking) return;
    baking = true;

    const bgImg = fabricCanvas.backgroundImage;
    if (!bgImg) { baking = false; return; }

    const el = bgImg.getElement();
    const cw = fabricCanvas.width;
    const ch = fabricCanvas.height;

    const merged = document.createElement('canvas');
    merged.width = cw; merged.height = ch;
    const mCtx = merged.getContext('2d');

    mCtx.drawImage(
      el, 0, 0, el.naturalWidth, el.naturalHeight,
      bgImg.left || 0, bgImg.top || 0,
      el.naturalWidth  * (bgImg.scaleX || 1),
      el.naturalHeight * (bgImg.scaleY || 1)
    );
    mCtx.drawImage(overlay, 0, 0);

    overlayCtx.clearRect(0, 0, cw, ch);

    fabric.Image.fromURL(merged.toDataURL(), (newImg) => {
      newImg.set({ left: 0, top: 0, scaleX: 1, scaleY: 1, selectable: false, evented: false });
      fabricCanvas.setBackgroundImage(newImg, () => {
        fabricCanvas.renderAll();
        CanvasManager.snapshot();
        baking = false;
      });
    });
  }

  return { init, activate, deactivate, setBrushSize };
})();
