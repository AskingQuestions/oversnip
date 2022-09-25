<script>
  import { onMount, onDestroy } from "svelte";
  import CloseIcon from "@/assets/close.svg?raw";
  import FileIcon from "@/assets/file.svg?raw";
  import SettingsIcon from "@/assets/settings.svg?raw";
  import ScanIcon from "@/assets/scan.svg?raw";
  import UploadIcon from "@/assets/upload.svg?raw";
  import DeleteIcon from "@/assets/delete.svg?raw";
  import SearchIcon from "@/assets/search.svg?raw";
  import PaletteIcon from "@/assets/palette.svg?raw";
  import PenIcon from "@/assets/pen.svg?raw";
  import HighlighterIcon from "@/assets/highlighter.svg?raw";
  import EraserIcon from "@/assets/eraser.svg?raw";
  import RedactIcon from "@/assets/redact.svg?raw";
  import ArrowIcon from "@/assets/arrow.svg?raw";
  import RectIcon from "@/assets/rect.svg?raw";
  import Dropdown from "../components/Dropdown.svelte";
  import Vibrant from "node-vibrant";
  import PaletteColor from "../components/PaletteColor.svelte";
  import Slider from "../components/Slider.svelte";

  import { minimalPrintShortcut, settings } from "../stores/settings.js";

  import { createWorker } from "tesseract.js";
  import { text } from "svelte/internal";

  let drawingCanvas = document.createElement("canvas");
  let blurringCanvas = document.createElement("canvas");
  let blurringPreCanvas = document.createElement("canvas");

  let draggingFile = false;

  // Used to show a loading screen while anything is loading
  let globalLoading = false;

  // Stack of drawing operations
  let operations = [];
  let redo = [];

  // Raw words from tesseract.js
  let scannedWords = [];
  let scannedText = "";

  // This is inverted: 0 = Opaque, 1 = Transparent
  let opacity = 0;

  let showPalette = false;

  let hovering = false;

  let penSize = parseInt($settings["tool.pen.size"]);
  let penColor = $settings["tool.pen.color"];
  let highlighterSize = parseInt($settings["tool.highlighter.size"]);
  let highlighterColor = $settings["tool.highlighter.color"];
  let eraserSize = parseInt($settings["tool.eraser.size"]);
  let arrowSize = parseInt($settings["tool.arrow.size"]);
  let arrowColor = $settings["tool.arrow.color"];
  let rectSize = parseInt($settings["tool.box.size"]);
  let rectColor = $settings["tool.box.color"];
  let redactSize = parseInt($settings["tool.redact.size"]);

  let palette = [];

  let encoded = {};
  let margin = 0;
  let marginBottom = 0;
  let bounds = {};

  let imgEl;
  let fileCanvasEl;
  let cropEl;
  let resizeEl;
  let baseImg;
  let playCopied = false;

  let zoom = 1;
  let panX = 0;
  let panY = 0;

  let selectedTool = "";

  $: draggable = selectedTool == "";

  let isDown = false;
  let isResizing = false;
  let resizeDown = { x: 0, y: 0, width: 0, height: 0 };
  let boundsDown = { x: 0, y: 0, width: 0, height: 0 };
  let resizePosition = {
    axisX: 0,
    axisY: 0,
    signX: 0,
    signY: 0,
  };

  function printShortcut(key) {
    console.log($settings, key);
    return minimalPrintShortcut($settings["shortcut." + key]);
  }

  function useShortcut(key) {
    return JSON.stringify($settings["shortcut." + key]);
  }

  let touchDown = { x: 0, y: 0 };
  let panDown = { x: 0, y: 0 };
  let windowDown = [0, 0];

  function updateZoom() {
    imgEl.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    imgEl.style.transformOrigin = "top left";
  }

  function applyZoom(dz, targetX, targetY) {
    let oldZoom = zoom;

    zoom = Math.max(1, Math.min(10, zoom + (dz * (zoom * zoom)) / 2));

    panX = targetX - (targetX - panX) * (zoom / oldZoom);
    panY = targetY - (targetY - panY) * (zoom / oldZoom);

    // Clamp pan to prevent scrolling off the image
    let cropRect = cropEl.getBoundingClientRect();
    panX = Math.min(0, Math.max(-cropRect.width * (zoom - 1), panX));
    panY = Math.min(0, Math.max(-cropRect.height * (zoom - 1), panY));

    updateZoom();
  }

  function saveFile(fileName, urlFile) {
    let a = document.createElement("a");
    a.style = "display: none";
    document.body.appendChild(a);
    a.href = urlFile;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  }

  function handleKey(e) {
    if (e.code == "KeyS" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      imgEl.toBlob((blob) => {
        saveFile("snip.png", URL.createObjectURL(blob));
        // playCopied = true;
        // navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        // setTimeout(() => {
        //   playCopied = false;
        // }, 1000);
      });
    }
    if (e.code == "KeyZ" && (e.ctrlKey || e.metaKey)) {
      if (e.shiftKey) {
        if (redo.length > 0) {
          operations.push(redo.pop());
          paintCanvas();
        }
      } else {
        redo.push(operations.pop());
        paintCanvas();
      }
    }
    let sizes = {
      pen: [[10, 30, 50], (v) => (penSize = v)],
      highlighter: [[10, 30, 50], (v) => (highlighterSize = v)],
      eraser: [[10, 30, 50], (v) => (eraserSize = v)],
      arrow: [[10, 20, 30], (v) => (arrowSize = v)],
      rect: [[10, 20, 30], (v) => (rectSize = v)],
      redact: [[10, 20, 30], (v) => (redactSize = v)],
    };

    if (e.code == "Digit1") {
      if (selectedTool in sizes) {
        sizes[selectedTool][1](sizes[selectedTool][0][0]);
      }
    } else if (e.code == "Digit2") {
      if (selectedTool in sizes) {
        sizes[selectedTool][1](sizes[selectedTool][0][1]);
      }
    } else if (e.code == "Digit3") {
      if (selectedTool in sizes) {
        sizes[selectedTool][1](sizes[selectedTool][0][2]);
      }
    }

    if (
      e.code == "KeyC" &&
      (e.ctrlKey || e.metaKey) &&
      scannedWords.length == 0
    ) {
      // Copy the imgEl canvas to the clipboard
      imgEl.toBlob((blob) => {
        playCopied = true;
        navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setTimeout(() => {
          playCopied = false;
        }, 1000);
      });
    }
  }

  function startOperation() {
    let currentOp = {
      tool: selectedTool,
      frame: {
        left: bounds.left,
        top: bounds.top,
      },
      points: [],
      open: true,
      penColor,
      penSize,
      highlighterColor,
      highlighterSize,
      eraserSize,
      arrowColor,
      arrowSize,
      rectColor,
      rectSize,
      redactSize,
    };
    operations.push(currentOp);
    redo = [];
  }

  function touchMove(e) {
    mouseMove({
      clientX: e.touches[0].clientX,
      clientY: e.touches[0].clientY,
    });
  }

  let currentMove = { x: 0, y: 0 };

  setInterval(() => {
    if (isDown && !selectedTool) {
    }
  }, 1000 / 144);

  window.snip.onRecropped((newEncoded) => {
    encoded = newEncoded;
    margin = encoded.editorMargin * encoded.factor;
    marginBottom = encoded.editorMarginBottom * encoded.factor;
    calculateCropPlacement(true);
    paintCanvas();
  });

  async function mouseMove(event) {
    draggingFile = false;

    let x = event.screenX;
    let y = event.screenY;

    let dx = x - touchDown.x;
    let dy = y - touchDown.y;

    if (isResizing) {
      let signX = resizePosition.signX;
      let signY = resizePosition.signY;
      let axisX = resizePosition.axisX;
      let axisY = resizePosition.axisY;
      scannedWords = [];
      scannedText = "";
      await window.snip.recrop(
        boundsDown.x + (signX == -1 ? dx * axisX : 0),
        boundsDown.y + (signY == -1 ? dy * axisY : 0),
        boundsDown.width + dx * signX * axisX,
        boundsDown.height + dy * signY * axisY,
        resizeDown.x,
        resizeDown.y,
        signX == -1 ? dx * signX * -1 * axisX : 0,
        signY == -1 ? dy * signY * -1 * axisY : 0,
        boundsDown.editorMargin
      );
      return;
    }

    if (!isDown) return;

    if (!selectedTool) {
      if (zoom == 1) {
        currentMove = { x: windowDown[0] + dx, y: windowDown[1] + dy };
        window.snip.moveWindow(currentMove.x, currentMove.y);
      } else {
        panX = panDown.x + dx;
        panY = panDown.y + dy;
        applyZoom(0, 0, 0);
        updateZoom();
      }
      return;
    }

    if (operations.length == 0) {
      startOperation();
    }
    let currentOp = operations[operations.length - 1];
    if (currentOp.tool != selectedTool || !currentOp.open) {
      startOperation();
    }

    currentOp = operations[operations.length - 1];
    let imgRect = imgEl.getBoundingClientRect();
    let point = {
      x:
        ((event.clientX - imgRect.left) / imgRect.width) *
        encoded.bounds.width *
        encoded.factor,
      y:
        ((event.clientY - imgRect.top) / imgRect.height) *
        encoded.bounds.height *
        encoded.factor,
    };

    if (
      (selectedTool == "arrow" || selectedTool == "rect") &&
      currentOp.points.length == 2
    ) {
      currentOp.points[1] = point;
    } else {
      currentOp.points.push(point);
    }

    paintCanvas();
  }

  async function toolDown(e) {
    touchDown = {
      x: e.screenX,
      y: e.screenY,
    };

    panDown = {
      x: panX,
      y: panY,
    };

    windowDown = await window.snip.getWindowPosition();

    isDown = true;
    if (e.touches) {
      touchMove(e);
      touchMove(e);
    } else {
      mouseMove(e);
      mouseMove(e);
    }
  }

  function toolUp() {
    if (operations.length > 0) {
      operations[operations.length - 1].open = false;
      let op = operations[operations.length - 1];
      if (op.tool == "pen") {
        // Group close points
        let points = op.points;
        let newPoints = [];
        let lastPoint = points[0];
        newPoints.push(lastPoint);
        for (let i = 1; i < points.length; i++) {
          let point = points[i];
          let dist = Math.sqrt(
            Math.pow(lastPoint.x - point.x, 2) +
              Math.pow(lastPoint.y - point.y, 2)
          );
          if (dist > 10 || i == points.length - 1 || i == 1) {
            newPoints.push(point);
            lastPoint = point;
          }
        }
        console.log(`Pen: ${newPoints.length - op.points.length} points`);
        op.points = newPoints;
        paintCanvas();
      }
    }
    isDown = false;
    isResizing = false;
  }

  function handleToolSelect(tool) {
    if (selectedTool == tool) {
      selectedTool = "";
      return;
    }
    selectedTool = tool;
  }

  async function handleSearch() {
    globalLoading = true;

    let smallCanvas = document.createElement("canvas");
    let ctx = smallCanvas.getContext("2d");
    let aspectRatio = imgEl.width / imgEl.height;
    let maxSizes = {
      low: 360,
      medium: 720,
      high: 1024,
      ultra: 2048,
      full: 100000,
    };
    let maxSize = maxSizes[$settings["imageSearch.quality"]] || 360;
    console.log(maxSize);
    let maxDiv = Math.max(imgEl.width, imgEl.height);
    let scale = Math.min(1, maxSize / maxDiv);
    smallCanvas.width = imgEl.width * scale;
    smallCanvas.height = imgEl.height * scale;
    ctx.drawImage(imgEl, 0, 0, smallCanvas.width, smallCanvas.height);

    let url = smallCanvas.toDataURL("image/png");
    await window.snip.search(url.replace("data:image/png;base64,", ""));
    globalLoading = false;
  }

  let imgurUploadIndex = -1;

  async function handleUpload() {
    globalLoading = true;
    let url = imgEl.toDataURL("image/png");
    let resp = await window.snip.upload(
      url.replace("data:image/png;base64,", "")
    );
    imgurUploadIndex = resp.index;
    globalLoading = false;
  }

  async function handleDeleteUpload() {
    globalLoading = true;

    if (imgurUploadIndex == -1) return;

    await window.snip.deleteUpload(imgurUploadIndex);
    imgurUploadIndex = -1;
    globalLoading = false;
  }

  function handleClose() {
    window.close();
  }

  function gradient(a, b) {
    return (b.y - a.y) / (b.x - a.x);
  }

  function paintCanvas() {
    blurringCanvas.width = imgEl.width + 200;
    blurringCanvas.height = imgEl.height + 200;
    blurringPreCanvas.width = imgEl.width + 200;
    blurringPreCanvas.height = imgEl.height + 200;
    let didBlur = false;
    drawingCanvas.width = imgEl.width;
    drawingCanvas.height = imgEl.height;

    let ctx = drawingCanvas.getContext("2d");
    let ctxBlur = blurringCanvas.getContext("2d");
    let ctxPreBlur = blurringPreCanvas.getContext("2d");
    let ctxImg = imgEl.getContext("2d");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctxImg.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctxBlur.clearRect(0, 0, ctxBlur.canvas.width, ctxBlur.canvas.height);
    ctxImg.drawImage(baseImg, bounds.left, bounds.top);

    for (let op of operations) {
      let offsetX = bounds.left - op.frame.left;
      let offsetY = bounds.top - op.frame.top;
      if (op.tool == "redact") {
        ctxBlur.strokeStyle = "#ffffff";

        ctxBlur.lineJoin = "round";
        ctxBlur.lineCap = "round";
        ctxBlur.beginPath();
        didBlur = true;
        for (let i = 0; i < op.points.length; i++) {
          let point = op.points[i];
          if (i == 0) {
            ctxBlur.moveTo(offsetX + point.x + 100, offsetY + point.y + 100);
          } else {
            ctxBlur.lineTo(offsetX + point.x + 100, offsetY + point.y + 100);
          }
        }
        ctxBlur.lineWidth = op.redactSize * 4;
        ctxBlur.filter = "blur(8px)";
        ctxBlur.stroke();
        ctxBlur.filter = "blur(20px)";
        ctxBlur.stroke();
      }
    }

    if (didBlur) {
      ctxBlur.globalCompositeOperation = "source-in";
      ctxBlur.filter = "blur(40px)";

      ctxPreBlur.drawImage(
        baseImg,
        bounds.left + 100 - 100,
        bounds.top + 100 - 100,
        baseImg.width + 200,
        baseImg.height + 200
      );
      ctxPreBlur.drawImage(baseImg, bounds.left + 100, bounds.top + 100);
      ctxBlur.drawImage(blurringPreCanvas, 0, 0);
      ctx.drawImage(blurringCanvas, -100, -100);
    }

    for (let op of operations) {
      let offsetX = bounds.left - op.frame.left;
      let offsetY = bounds.top - op.frame.top;

      if (op.tool == "pen") {
        ctx.strokeStyle = op.penColor;
        ctx.lineWidth = op.penSize / 2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        let points = op.points.map((p) => {
          return {
            x: p.x + offsetX,
            y: p.y + offsetY,
          };
        });

        if (points.length > 3) {
          ctx.beginPath(), ctx.moveTo(points[0].x, points[0].y);
          // draw a bunch of quadratics, using the average of two points as the control point
          for (var i = 1; i < points.length - 2; i++) {
            var c = (points[i].x + points[i + 1].x) / 2,
              d = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, c, d);
          }
          ctx.quadraticCurveTo(
            points[i].x,
            points[i].y,
            points[i + 1].x,
            points[i + 1].y
          ),
            ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(points[0].x, points[0].y, op.penSize / 60, 0, 2 * Math.PI);
          ctx.stroke();
        }
      } else if (op.tool == "highlighter") {
        ctx.strokeStyle = op.highlighterColor;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = op.highlighterSize * 2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        let points = op.points.map((p) => {
          return {
            x: p.x + offsetX,
            y: p.y + offsetY,
          };
        });

        if (points.length > 3) {
          ctx.beginPath(), ctx.moveTo(points[0].x, points[0].y);
          // draw a bunch of quadratics, using the average of two points as the control point
          for (var i = 1; i < points.length - 2; i++) {
            var c = (points[i].x + points[i + 1].x) / 2,
              d = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, c, d);
          }
          ctx.quadraticCurveTo(
            points[i].x,
            points[i].y,
            points[i + 1].x,
            points[i + 1].y
          ),
            ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(points[0].x, points[0].y, op.penSize / 60, 0, 2 * Math.PI);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (op.tool == "eraser") {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = op.eraserSize * 2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let i = 0; i < op.points.length; i++) {
          let point = op.points[i];
          if (i == 0) {
            ctx.moveTo(point.x + offsetX, point.y + offsetY);
          } else {
            ctx.lineTo(point.x + offsetX, point.y + offsetY);
          }
        }
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.stroke();
        ctx.restore();
      } else if (op.tool == "text") {
        ctx.font = op.textSize + "px " + op.textFont;
        ctx.fillStyle = op.textColor;
        ctx.fillText(op.text, op.textX, op.textY);
      } else if (op.tool == "arrow") {
        if (op.points.length < 2) continue;
        ctx.strokeStyle = op.arrowColor;
        ctx.lineWidth = op.arrowSize;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(op.points[0].x + offsetX, op.points[0].y + offsetY);
        ctx.lineTo(op.points[1].x + offsetX, op.points[1].y + offsetY);
        ctx.stroke();
        let angle = Math.atan2(
          op.points[1].y - op.points[0].y,
          op.points[1].x - op.points[0].x
        );
        ctx.beginPath();
        ctx.moveTo(
          op.points[1].x +
            offsetX -
            op.arrowSize * 3 * Math.cos(angle - Math.PI / 5),
          op.points[1].y +
            offsetY -
            op.arrowSize * 3 * Math.sin(angle - Math.PI / 5)
        );
        ctx.lineTo(op.points[1].x + offsetX, op.points[1].y + offsetY);
        ctx.lineTo(
          op.points[1].x +
            offsetX -
            op.arrowSize * 3 * Math.cos(angle + Math.PI / 5),
          op.points[1].y +
            offsetY -
            op.arrowSize * 3 * Math.sin(angle + Math.PI / 5)
        );
        ctx.stroke();
      } else if (op.tool == "rect") {
        if (op.points.length < 2) continue;
        ctx.strokeStyle = op.rectColor;
        ctx.lineWidth = op.rectSize / 2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.rect(
          op.points[0].x + offsetX,
          op.points[0].y + offsetY,
          op.points[1].x - op.points[0].x,
          op.points[1].y - op.points[0].y
        );
        ctx.stroke();
      }
    }

    ctxImg.drawImage(drawingCanvas, 0, 0);

    let ctxFile = fileCanvasEl.getContext("2d");
    let maxSize = 360;
    let maxDiv = Math.max(imgEl.width, imgEl.height);
    let scale = maxSize / maxDiv;
    fileCanvasEl.width = imgEl.width * scale;
    fileCanvasEl.height = imgEl.height * scale;
    ctxFile.drawImage(imgEl, 0, 0, fileCanvasEl.width, fileCanvasEl.height);
  }

  function calculateCropPlacement(disallowShrink) {
    bounds.left = Math.round(-encoded.bounds.x * encoded.factor);
    bounds.top = Math.round(-encoded.bounds.y * encoded.factor);
    if (
      (encoded.bounds.width > window.innerWidth ||
        encoded.bounds.height > window.innerHeight) &&
      !disallowShrink
    ) {
      let aspect = encoded.bounds.width / encoded.bounds.height;
      let calculatedWidth = Math.floor(
        window.innerWidth - encoded.editorMargin * 2
      );
      cropEl.style.width = calculatedWidth + "px";
      cropEl.style.height = calculatedWidth / aspect + "px";
      cropEl.style.left = encoded.editorMargin + "px";

      resizeEl.style.width = cropEl.style.width;
      resizeEl.style.height = cropEl.style.height;
      resizeEl.style.left = cropEl.style.left;
    } else {
      cropEl.style.width = Math.floor(encoded.bounds.width) + "px";
      cropEl.style.height = Math.floor(encoded.bounds.height) + "px";
      cropEl.style.left = encoded.editorMargin + "px";

      resizeEl.style.width = cropEl.style.width;
      resizeEl.style.height = cropEl.style.height;
      resizeEl.style.left = cropEl.style.left;
    }
    imgEl.width = encoded.bounds.width * encoded.factor;
    imgEl.height = encoded.bounds.height * encoded.factor;
  }

  function renderImage() {
    baseImg = new Image();
    baseImg.src = "snip://" + encoded.index + ".png";
    baseImg.onload = async () => {
      paintCanvas();
      setTimeout(async () => {
        let now = performance.now();
        let tempImg = new Image();
        tempImg.src = imgEl.toDataURL();
        let v = new Vibrant(tempImg);
        let pal = await v.getPalette();
        palette = Object.keys(pal)
          .map((k) => pal[k])
          .filter((c) => c != null);
        palette.sort((a, b) => b.population - a.population);
        console.log(palette);
        console.log(`Took ${performance.now() - now} to generate the palette`);
      }, 1000);
    };
    calculateCropPlacement();
  }

  function handleDragend(event) {
    draggingFile = false;
  }

  function handleDragstart(event) {
    event.preventDefault();
    console.log("Drag", event);
    draggingFile = true;
    // file download contents, for dropping into a file system
    let url = imgEl.toDataURL("image/png");
    window.snip.startDrag(url.replace("data:image/png;base64,", ""));
  }

  function handleMouseEnter() {
    if (encoded.autoImageSearch) return;
    hovering = true;
  }

  function handleMouseLeave() {
    hovering = false;
  }

  function handleDragover() {
    draggingFile = true;
  }

  function normalizePointToElement(point, element) {
    let rect = element.getBoundingClientRect();
    return {
      x: point.x - rect.left,
      y: point.y - rect.top,
    };
  }

  function handleMousewheel(e) {
    console.log("Mousewheel", e);
    e.preventDefault();
    if (e.ctrlKey) {
      let delta = e.deltaY;
      let targetPoint = normalizePointToElement(
        { x: e.clientX + panX, y: e.clientY + panY },
        imgEl
      );
      if (delta > 0) {
        applyZoom(-0.1, targetPoint.x, targetPoint.y);
      } else {
        applyZoom(0.1, targetPoint.x, targetPoint.y);
      }
    }
  }

  async function handleResizeDown(e) {
    touchDown = {
      x: e.screenX,
      y: e.screenY,
    };

    let x = parseInt(e.target.dataset.x);
    let y = parseInt(e.target.dataset.y);
    resizePosition = {
      axisX: x == 1 ? 0 : 1,
      axisY: y == 1 ? 0 : 1,
      signX: x - 1,
      signY: y - 1,
    };
    console.log("Resize down", resizePosition);
    resizeDown = await window.snip.getWindowBounds();
    // resizeDown.x = resizeDown.x - encoded.bounds.x + encoded.editorMargin;
    // resizeDown.y = resizeDown.y - encoded.bounds.y + 20;

    boundsDown.x = encoded.bounds.x;
    boundsDown.y = encoded.bounds.y;
    boundsDown.width = encoded.bounds.width;
    boundsDown.height = encoded.bounds.height;
    boundsDown.editorMargin = encoded.editorMargin;

    isResizing = true;
  }

  async function handleScan() {
    globalLoading = true;
    if (scannedWords.length > 0) {
      scannedWords = [];
      scannedText = "";
      return;
    }

    const worker = createWorker({
      logger: (m) => console.log(m),
    });

    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");
    let resp = await worker.recognize(imgEl);
    scannedText = resp.data.text;

    scannedWords = resp.data.symbols.map((s) => {
      let x = s.bbox.x0;
      let y = s.bbox.y0;
      let w = s.bbox.x1 - s.bbox.x0;
      let h = s.bbox.y1 - s.bbox.y0;

      let d = {
        text: s.text,
        real: {
          line: h / encoded.factor + "px",
          font: h / encoded.factor + "px",
          // spacing:
          //   1.65 *
          //     s.text.length *
          //     ((s.text.length * (h / encoded.factor)) / (w / encoded.factor)) +
          //   "px",
          spacing:
            (s.text.length * (h / encoded.factor)) / (w / encoded.factor) / 4 +
            "em",
          left: (x / encoded.bounds.width / encoded.factor) * 100 + "%",
          top: (y / encoded.bounds.height / encoded.factor) * 100 + "%",
          width: (w / encoded.bounds.width / encoded.factor) * 100 + "%",
          height: (h / encoded.bounds.height / encoded.factor) * 100 + "%",
        },
      };
      return d;
    });
    await worker.terminate();
    globalLoading = false;
  }

  $: inverseFactor = 1 / encoded.factor;

  onMount(() => {
    encoded = snip.getEncoded();
    hovering = !encoded.autoImageSearch;
    console.log(encoded);
    margin = encoded.editorMargin * encoded.factor;
    marginBottom = encoded.editorMarginBottom * encoded.factor;
    renderImage();
    paintCanvas();
    setTimeout(async () => {
      if ($settings["autocopy"]) {
        imgEl.toBlob((blob) => {
          console.log("Autocopying", blob);
          navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        });
      }
      console.log(encoded);
      if (encoded.autoImageSearch) {
        await handleSearch();
        close();
      }
    }, 100);

    document.addEventListener("mouseup", toolUp);
    document.addEventListener("mousemove", mouseMove);
    document.addEventListener("touchmove", touchMove);
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mouseenter", handleMouseEnter);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("dragover", handleDragover);
    window.addEventListener("wheel", handleMousewheel);
  });
  onDestroy(() => {
    document.removeEventListener("mouseup", toolUp);
    document.removeEventListener("mousemove", mouseMove);
    document.removeEventListener("touchmove", touchMove);
    document.removeEventListener("keydown", handleKey);
    document.removeEventListener("mouseenter", handleMouseEnter);
    document.removeEventListener("mouseleave", handleMouseLeave);
    document.removeEventListener("dragover", handleDragover);
    window.removeEventListener("wheel", handleMousewheel);
  });
</script>

<div
  class="wrap"
  class:disable-input={globalLoading}
  style={`--margin: ${margin * inverseFactor}px; --marginBottom: ${
    marginBottom * inverseFactor
  }px`}
>
  <div
    class="bar bar--bottom"
    class:show-opacity={hovering || selectedTool}
    style={`height: ${
      marginBottom * inverseFactor
    }px; bottom: 0px; width: 100%`}
  >
    <div
      class="tool-options tool-sider tool-sider--left"
      class:tool-sider--left--active={!!selectedTool}
    >
      {#if selectedTool == "pen"}
        <Dropdown
          size={true}
          options={[10, 20, 30, 40, 50]}
          bind:value={penSize}
        />
        <input type="color" bind:value={penColor} />
      {/if}

      {#if selectedTool == "highlighter"}
        <Dropdown
          size={true}
          options={[10, 20, 30, 40, 50]}
          bind:value={highlighterSize}
        />
        <input type="color" bind:value={highlighterColor} />
      {/if}

      {#if selectedTool == "eraser"}
        <Dropdown
          size={true}
          options={[10, 20, 30, 40, 50]}
          bind:value={eraserSize}
        />
      {/if}

      {#if selectedTool == "arrow"}
        <Dropdown size={true} options={[10, 20, 30]} bind:value={arrowSize} />
        <input type="color" bind:value={arrowColor} />
      {/if}

      {#if selectedTool == "rect"}
        <Dropdown size={true} options={[10, 20, 30]} bind:value={rectSize} />
        <input type="color" bind:value={rectColor} />
      {/if}

      {#if selectedTool == "redact"}
        <Dropdown size={true} options={[10, 20, 30]} bind:value={redactSize} />
      {/if}
    </div>
    <div
      class="tool tool--pen tool--first"
      data-tooltip="Pen [{($settings, printShortcut('pen'))}]"
      data-shortcut={($settings, useShortcut("pen"))}
      on:click={() => handleToolSelect("pen")}
      class:tool--active={selectedTool == "pen"}
    >
      {@html PenIcon}
    </div>
    <div
      class="tool tool--highlighter"
      data-tooltip="Highlighter [{($settings, printShortcut('highlighter'))}]"
      data-shortcut={($settings, useShortcut("highlighter"))}
      on:click={() => handleToolSelect("highlighter")}
      class:tool--active={selectedTool == "highlighter"}
    >
      {@html HighlighterIcon}
    </div>
    <div
      class="tool tool--eraser"
      data-tooltip="Eraser [{($settings, printShortcut('eraser'))}]"
      data-shortcut={($settings, useShortcut("eraser"))}
      on:click={() => handleToolSelect("eraser")}
      class:tool--active={selectedTool == "eraser"}
    >
      {@html EraserIcon}
    </div>
    <div
      class="tool tool--redact"
      data-tooltip="Redact [{($settings, printShortcut('redact'))}]"
      data-shortcut={($settings, useShortcut("redact"))}
      on:click={() => handleToolSelect("redact")}
      class:tool--active={selectedTool == "redact"}
    >
      {@html RedactIcon}
    </div>
    <div
      class="tool tool--arrow"
      data-tooltip="Arrow [{($settings, printShortcut('arrow'))}]"
      data-shortcut={($settings, useShortcut("arrow"))}
      on:click={() => handleToolSelect("arrow")}
      class:tool--active={selectedTool == "arrow"}
    >
      {@html ArrowIcon}
    </div>
    <div
      class="tool tool--rect tool--last"
      data-tooltip="Box [{($settings, printShortcut('box'))}]"
      data-shortcut={($settings, useShortcut("box"))}
      on:click={() => handleToolSelect("rect")}
      class:tool--active={selectedTool == "rect"}
    >
      {@html RectIcon}
    </div>
    <div class="tool-sider tool-sider--right">
      <div
        class:show-opacity={hovering}
        class=" file fab--file"
        class:fab--file--active={draggingFile}
        draggable="true"
        on:dragstart={handleDragstart}
        on:dragend={handleDragend}
      >
        <canvas
          bind:this={fileCanvasEl}
          data-tooltip="Drag and drop this file anywhere"
          data-tooltip-action="click"
        />
      </div>
    </div>
  </div>
  <div
    class="bar bar--right"
    style={`width: ${margin * inverseFactor}px; right: 0; height: 100%`}
  >
    <div class="fab-bar">
      <div
        class="fab close"
        class:show-opacity={hovering || selectedTool}
        on:click={handleClose}
      >
        {@html CloseIcon}
      </div>
      <div
        class:show-opacity={hovering || selectedTool}
        data-tooltip="Image Search [{($settings, printShortcut('search'))}]"
        data-shortcut={($settings, useShortcut("search"))}
        class="fab search stack-1"
        on:click={handleSearch}
      >
        {@html SearchIcon}
      </div>

      <div
        data-tooltip="Palette [{($settings, printShortcut('palette'))}]"
        data-shortcut={($settings, useShortcut("palette"))}
        class:show-opacity={hovering || selectedTool}
        class="fab palette stack-2"
        on:click={() => {
          showPalette = !showPalette;
        }}
      >
        {@html PaletteIcon}
      </div>

      <div
        data-tooltip="Scan Text [{($settings, printShortcut('scan'))}]"
        data-shortcut={($settings, useShortcut("scan"))}
        class:show-opacity={hovering || selectedTool}
        class="fab fab-small scan stack-2"
        on:click={handleScan}
      >
        {@html ScanIcon}
      </div>

      {#if imgurUploadIndex == -1}
        <div
          data-tooltip="To Imgur [{($settings, printShortcut('imgur'))}]"
          data-shortcut={($settings, useShortcut("imgur"))}
          class:show-opacity={hovering || selectedTool}
          class="fab upload stack-2"
          on:click={handleUpload}
        >
          {@html UploadIcon}
        </div>
      {:else}
        <div
          data-tooltip="Delete Imgur"
          class:show-opacity={hovering || selectedTool}
          class="fab upload stack-2"
          on:click={handleDeleteUpload}
        >
          {@html DeleteIcon}
        </div>
      {/if}

      <div class="opacity-slider" class:show-opacity={hovering || selectedTool}>
        <Slider direction="vertical" bind:value={opacity} />
      </div>

      <div
        data-tooltip="Settings [{($settings, printShortcut('settings'))}]"
        data-shortcut={($settings, useShortcut("settings"))}
        class:show-opacity={hovering || selectedTool}
        class="fab settings stack-2 fab-end"
        on:click={() => {
          window.settings.openSettings();
        }}
      >
        {@html SettingsIcon}
      </div>

      <div
        class="mover"
        style={draggable && false
          ? `-webkit-app-region: drag;`
          : `pointer-events: none;`}
      />
    </div>
  </div>
  {#if showPalette}
    <div
      class="bar bar--left"
      class:show-opacity={true}
      style={`width: ${margin * inverseFactor}px; left: 0; height: 100%`}
    >
      {#each palette as swatch, i}
        <div style="--index: {i}">
          <PaletteColor hex={swatch.hex} />
        </div>
      {/each}
    </div>
  {/if}

  <div
    class="resizer"
    bind:this={resizeEl}
    style="top: 20px;"
    class:show-opacity={hovering && !selectedTool}
  >
    <div
      on:mousedown={handleResizeDown}
      class="recrop"
      data-x="0"
      data-y="0"
      style="cursor: nw-resize"
    />
    <div
      on:mousedown={handleResizeDown}
      class="recrop"
      data-x="1"
      data-y="0"
      style="cursor: n-resize; width: calc(100% - 20px);"
    />
    <div
      on:mousedown={handleResizeDown}
      class="recrop"
      data-x="2"
      data-y="0"
      style="cursor: ne-resize"
    />
    <div
      on:mousedown={handleResizeDown}
      class="recrop"
      data-x="0"
      data-y="1"
      style="cursor: e-resize; height: calc(100% - 20px);"
    />
    <div
      on:mousedown={handleResizeDown}
      class="recrop"
      data-x="2"
      data-y="1"
      style="cursor: e-resize; height: calc(100% - 20px);"
    />
    <div
      on:mousedown={handleResizeDown}
      class="recrop"
      data-x="0"
      data-y="2"
      style="cursor: ne-resize"
    />
    <div
      on:mousedown={handleResizeDown}
      class="recrop"
      data-x="1"
      data-y="2"
      style="cursor: n-resize; width: calc(100% - 20px);"
    />
    <div
      on:mousedown={handleResizeDown}
      class="recrop"
      data-x="2"
      data-y="2"
      style="cursor: nw-resize"
    />
  </div>
  <div
    class="crop"
    class:crop--animation={$settings["playSnipAnimation"]}
    class:crop--loading={globalLoading}
    bind:this={cropEl}
    style="top: 20px; opacity: {1 - opacity};"
  >
    <canvas
      style="width: 100%; height: 100%;"
      class:play-copied={playCopied}
      bind:this={imgEl}
      on:mousedown={toolDown}
      on:mouseup={toolUp}
      on:touchstart={toolDown}
      on:touchend={toolUp}
    />
    {#if globalLoading}
      <div class="lds-ellipsis">
        <div />
        <div />
        <div />
        <div />
      </div>
    {/if}
  </div>
  {#if scannedText}
    <div
      class="scan-box"
      on:click={(e) => {
        if (e.target.matches(".scan-box")) {
          scannedText = "";
          scannedWords = [];
        }
      }}
    >
      <textarea value={scannedText} />
    </div>
  {/if}
</div>

<style>
  .play-copied {
    animation: copied 0.3s ease-in-out;
  }

  @keyframes copied {
    0% {
      filter: brightness(1);
    }
    50% {
      filter: brightness(0);
    }
    100% {
      filter: brightness(1);
    }
  }
</style>
