const FillTool = (() => {

  // min(R,G,B) < 100이면 "선(엣지)"으로 판단
  function isEdge(data, pos) {
    const i = pos * 4;
    return Math.min(data[i], data[i + 1], data[i + 2]) < 100;
  }

  function floodFillMask(data, width, height, startX, startY) {
    const mask = new Uint8Array(width * height);
    const startPos = startY * width + startX;

    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return mask;
    if (isEdge(data, startPos)) return mask;

    const stack = [startPos];
    mask[startPos] = 1;

    while (stack.length > 0) {
      const pos = stack.pop();
      const x = pos % width;
      const y = Math.floor(pos / width);

      const neighbors = [];
      if (x > 0)           neighbors.push(pos - 1);
      if (x < width - 1)   neighbors.push(pos + 1);
      if (y > 0)           neighbors.push(pos - width);
      if (y < height - 1)  neighbors.push(pos + width);

      for (const n of neighbors) {
        if (mask[n] || isEdge(data, n)) continue;
        mask[n] = 1;
        stack.push(n);
      }
    }

    return mask;
  }

  function getBackgroundData(fabricCanvas) {
    const bgImg = fabricCanvas.backgroundImage;
    if (!bgImg) return null;

    const element = bgImg.getElement();
    const w = fabricCanvas.width;
    const h = fabricCanvas.height;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d');

    ctx.drawImage(
      element,
      0, 0, element.naturalWidth, element.naturalHeight,
      bgImg.left || 0, bgImg.top || 0,
      element.naturalWidth * (bgImg.scaleX || 1),
      element.naturalHeight * (bgImg.scaleY || 1)
    );

    return { data: ctx.getImageData(0, 0, w, h), width: w, height: h };
  }

  function hexToRgb(hex) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
  }

  function apply(fabricCanvas, px, py, color, opacity, callback) {
    const bg = getBackgroundData(fabricCanvas);
    if (!bg) {
      callback('no-image');
      return;
    }

    const { data: imgData, width, height } = bg;
    const mask = floodFillMask(imgData.data, width, height, Math.round(px), Math.round(py));

    const filled = mask.reduce((a, b) => a + b, 0);
    if (filled < 20 || filled > width * height * 0.85) {
      callback('too-small-or-large');
      return;
    }

    // 마스크 픽셀에만 fill color 적용한 오프스크린 캔버스
    const fillCanvas = document.createElement('canvas');
    fillCanvas.width = width;
    fillCanvas.height = height;
    const fCtx = fillCanvas.getContext('2d');
    const fillData = fCtx.createImageData(width, height);
    const [r, g, b] = hexToRgb(color);
    const a = Math.round(opacity * 255);

    for (let i = 0; i < mask.length; i++) {
      if (mask[i]) {
        fillData.data[i * 4]     = r;
        fillData.data[i * 4 + 1] = g;
        fillData.data[i * 4 + 2] = b;
        fillData.data[i * 4 + 3] = a;
      }
    }
    fCtx.putImageData(fillData, 0, 0);

    fabric.Image.fromURL(fillCanvas.toDataURL(), (img) => {
      img.set({ left: 0, top: 0 });
      callback(null, img);
    });
  }

  return { apply };
})();
