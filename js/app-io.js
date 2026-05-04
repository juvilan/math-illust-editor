function initIO(canvas) {
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
}
