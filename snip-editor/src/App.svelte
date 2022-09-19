<script>
  import { onMount, onDestroy } from "svelte";
  import CloseIcon from "./assets/close.svg?raw";
  import FileIcon from "./assets/file.svg?raw";
  import SearchIcon from "./assets/search.svg?raw";
  import PaletteIcon from "./assets/palette.svg?raw";
  import PenIcon from "./assets/pen.svg?raw";
  import HighlighterIcon from "./assets/highlighter.svg?raw";
  import EraserIcon from "./assets/eraser.svg?raw";
  import RedactIcon from "./assets/redact.svg?raw";
  import ArrowIcon from "./assets/arrow.svg?raw";
  import RectIcon from "./assets/rect.svg?raw";
  import Dropdown from "./Dropdown.svelte";
  import Vibrant from "node-vibrant";
  import PaletteColor from "./PaletteColor.svelte";

  let drawingCanvas = document.createElement("canvas");
  let blurringCanvas = document.createElement("canvas");

  // Stack of drawing operations
  let operations = [];
  let redo = [];

  let showPalette = false;

  let hovering = false;

  let penSize = 20;
  let penColor = "#FF0000";
  let highlighterSize = 20;
  let highlighterColor = "#ffff00";
  let eraserSize = 50;
  let arrowSize = 10;
  let arrowColor = "#ff0000";
  let rectSize = 10;
  let rectColor = "#ff0000";
  let redactSize = 20;

  let palette = [];

  let encoded = {};
  let margin = 0;
  let bounds = {};

  let imgEl;
  let cropEl;
  let baseImg;

  let selectedTool = "";

  $: draggable = selectedTool == "";

  let isDown = false;

  function handleKey(e) {
    console.log(e);
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
  }

  function startOperation() {
    let currentOp = {
      tool: selectedTool,
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

  function mouseMove(event) {
    if (!isDown) return;
    if (operations.length == 0) {
      startOperation();
    }
    let currentOp = operations[operations.length - 1];
    if (currentOp.tool != selectedTool || !currentOp.open) {
      startOperation();
    }

    currentOp = operations[operations.length - 1];
    let point = {
      x: event.clientX * encoded.factor - margin,
      y: event.clientY * encoded.factor,
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

  function toolDown(e) {
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
  }

  function handleToolSelect(tool) {
    if (selectedTool == tool) {
      selectedTool = "";
      return;
    }
    selectedTool = tool;
  }

  function handleSearch() {
    let smallCanvas = document.createElement("canvas");
    let ctx = smallCanvas.getContext("2d");
    let aspectRatio = imgEl.width / imgEl.height;
    let maxSize = 360;
    let maxDiv = Math.max(imgEl.width, imgEl.height);
    let scale = maxSize / maxDiv;
    smallCanvas.width = imgEl.width * scale;
    smallCanvas.height = imgEl.height * scale;
    ctx.drawImage(imgEl, 0, 0, smallCanvas.width, smallCanvas.height);

    let url = smallCanvas.toDataURL("image/png");
    window.snip.search(url.replace("data:image/png;base64,", ""));
  }

  function handleClose() {
    window.close();
  }

  function gradient(a, b) {
    return (b.y - a.y) / (b.x - a.x);
  }

  function paintCanvas() {
    blurringCanvas.width = imgEl.width;
    blurringCanvas.height = imgEl.height;
    let didBlur = false;
    drawingCanvas.width = imgEl.width;
    drawingCanvas.height = imgEl.height;
    imgEl.style.width = imgEl.width * (1 / encoded.factor) + "px";
    imgEl.style.height = imgEl.height * (1 / encoded.factor) + "px";
    let ctx = drawingCanvas.getContext("2d");
    let ctxBlur = blurringCanvas.getContext("2d");
    let ctxImg = imgEl.getContext("2d");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctxImg.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctxBlur.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctxImg.drawImage(baseImg, bounds.left, bounds.top);

    for (let op of operations) {
      if (op.tool == "redact") {
        ctxBlur.strokeStyle = "#ffffff";

        ctxBlur.lineJoin = "round";
        ctxBlur.lineCap = "round";
        ctxBlur.beginPath();
        didBlur = true;
        for (let i = 0; i < op.points.length; i++) {
          let point = op.points[i];
          if (i == 0) {
            ctxBlur.moveTo(point.x, point.y);
          } else {
            ctxBlur.lineTo(point.x, point.y);
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
      ctxBlur.fillStyle = "#000";
      ctxBlur.fillRect(0, 0, ctxBlur.canvas.width, ctxBlur.canvas.height);
      ctxBlur.filter = "blur(40px)";
      ctxBlur.drawImage(baseImg, bounds.left, bounds.top);
      // ctxBlur.fillStyle = "red";
      // ctxBlur.fillRect(0, 0, ctxBlur.canvas.width, ctxBlur.canvas.height);
      ctx.drawImage(blurringCanvas, 0, 0);
    }

    for (let op of operations) {
      if (op.tool == "pen") {
        ctx.strokeStyle = op.penColor;
        ctx.lineWidth = op.penSize;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        let points = op.points;
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

        // let f = 0.3;
        // let t = 0.6;
        // let points = op.points;
        // ctx.moveTo(points[0].x, points[0].y);

        // for (var i = 0; i < points.length - 1; i++) {
        //   var x_mid = (points[i].x + points[i + 1].x) / 2;
        //   var y_mid = (points[i].y + points[i + 1].y) / 2;
        //   var cp_x1 = (x_mid + points[i].x) / 2;
        //   var cp_x2 = (x_mid + points[i + 1].x) / 2;
        //   ctx.quadraticCurveTo(cp_x1, points[i].y, x_mid, y_mid);
        //   ctx.quadraticCurveTo(
        //     cp_x2,
        //     points[i + 1].y,
        //     points[i + 1].x,
        //     points[i + 1].y
        //   );
        // }

        // ctx.moveTo(points[0].x, points[0].y);

        // let m = 0;
        // let dx1 = 0;
        // let dy1 = 0;
        // let dx2 = 0;
        // let dy2 = 0;
        // let nexP;

        // let preP = points[0];
        // for (let i = 1; i < points.length; i++) {
        //   let curP = points[i];
        //   nexP = points[i + 1];
        //   if (nexP) {
        //     m = gradient(preP, nexP);
        //     dx2 = (nexP.x - curP.x) * -f;
        //     dy2 = dx2 * m * t;
        //   } else {
        //     dx2 = 0;
        //     dy2 = 0;
        //   }
        //   ctx.bezierCurveTo(
        //     preP.x - dx1,
        //     preP.y - dy1,
        //     curP.x + dx2,
        //     curP.y + dy2,
        //     curP.x,
        //     curP.y
        //   );
        //   dx1 = dx2;
        //   dy1 = dy2;
        //   preP = curP;
        // }

        // ctx.beginPath();
        // for (let i = 0; i < op.points.length; i++) {
        //   let point = op.points[i];
        //   if (i == 0) {
        //     ctx.moveTo(point.x, point.y);
        //   } else {
        //     ctx.lineTo(point.x, point.y);
        //   }
        // }
      } else if (op.tool == "highlighter") {
        ctx.strokeStyle = op.highlighterColor;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = op.highlighterSize * 2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        let points = op.points;
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
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
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
        ctx.moveTo(op.points[0].x, op.points[0].y);
        ctx.lineTo(op.points[1].x, op.points[1].y);
        ctx.stroke();
        let angle = Math.atan2(
          op.points[1].y - op.points[0].y,
          op.points[1].x - op.points[0].x
        );
        ctx.beginPath();
        ctx.moveTo(
          op.points[1].x - op.arrowSize * 4 * Math.cos(angle - Math.PI / 5),
          op.points[1].y - op.arrowSize * 4 * Math.sin(angle - Math.PI / 5)
        );
        ctx.lineTo(op.points[1].x, op.points[1].y);
        ctx.lineTo(
          op.points[1].x - op.arrowSize * 4 * Math.cos(angle + Math.PI / 5),
          op.points[1].y - op.arrowSize * 4 * Math.sin(angle + Math.PI / 5)
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
          op.points[0].x,
          op.points[0].y,
          op.points[1].x - op.points[0].x,
          op.points[1].y - op.points[0].y
        );
        ctx.stroke();
      }
    }

    ctxImg.drawImage(drawingCanvas, 0, 0);
  }

  function renderImage() {
    baseImg = new Image();
    baseImg.src = "snip://" + encoded.index + ".png";
    baseImg.onload = async () => {
      paintCanvas();
      setTimeout(async () => {
        let now = performance.now();
        let v = new Vibrant(baseImg);
        let pal = await v.getPalette();
        palette = Object.keys(pal).map((k) => pal[k]);
        palette.sort((a, b) => b.population - a.population);
        console.log(palette);
        console.log(`Took ${performance.now() - now} to generate the palette`);
      }, 1000);
    };
    bounds.left = -encoded.bounds.x * encoded.factor;
    bounds.top = -encoded.bounds.y * encoded.factor;
    cropEl.style.width = encoded.bounds.width + "px";
    cropEl.style.height = encoded.bounds.height + "px";
    cropEl.style.left = encoded.editorMargin + "px";
    imgEl.width = encoded.bounds.width * encoded.factor;
    imgEl.height = encoded.bounds.height * encoded.factor;
  }

  function handleDragstart(event) {
    event.preventDefault();
    console.log("Drag", event);
    // file download contents, for dropping into a file system
    let url = imgEl.toDataURL("image/png");
    window.snip.startDrag(url.replace("data:image/png;base64,", ""));
    // console.log(url);
    // event.dataTransfer.setData("Image", url);
    // event.dataTransfer.setDragImage(imgEl, imgEl.width / 2, imgEl.height / 2);
  }

  function handleMouseEnter() {
    hovering = true;
  }

  function handleMouseLeave() {
    hovering = false;
  }

  onMount(() => {
    encoded = snip.getEncoded();
    margin = encoded.editorMargin * encoded.factor;
    renderImage();
    paintCanvas();
    document.addEventListener("mouseup", toolUp);
    document.addEventListener("mousemove", mouseMove);
    document.addEventListener("touchmove", touchMove);
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mouseenter", handleMouseEnter);
    document.addEventListener("mouseleave", handleMouseLeave);
  });
  onDestroy(() => {
    document.removeEventListener("mouseup", toolUp);
    document.removeEventListener("mousemove", mouseMove);
    document.removeEventListener("touchmove", touchMove);
    document.removeEventListener("keydown", handleKey);
    document.removeEventListener("mouseenter", handleMouseEnter);
    document.removeEventListener("mouseleave", handleMouseLeave);
  });
</script>

<div class="wrap" style={`--margin: ${margin}px`}>
  <div
    class="bar bar--bottom"
    class:show-opacity={hovering || selectedTool}
    style={`height: ${margin}px; bottom: 0px; width: 100%`}
  >
    <div class="tool-options tool-sider">
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
      on:click={() => handleToolSelect("pen")}
      class:tool--active={selectedTool == "pen"}
    >
      {@html PenIcon}
    </div>
    <div
      class="tool tool--highlighter"
      on:click={() => handleToolSelect("highlighter")}
      class:tool--active={selectedTool == "highlighter"}
    >
      {@html HighlighterIcon}
    </div>
    <div
      class="tool tool--eraser"
      on:click={() => handleToolSelect("eraser")}
      class:tool--active={selectedTool == "eraser"}
    >
      {@html EraserIcon}
    </div>
    <div
      class="tool tool--redact"
      on:click={() => handleToolSelect("redact")}
      class:tool--active={selectedTool == "redact"}
    >
      {@html RedactIcon}
    </div>
    <div
      class="tool tool--arrow"
      on:click={() => handleToolSelect("arrow")}
      class:tool--active={selectedTool == "arrow"}
    >
      {@html ArrowIcon}
    </div>
    <div
      class="tool tool--rect tool--last"
      on:click={() => handleToolSelect("rect")}
      class:tool--active={selectedTool == "rect"}
    >
      {@html RectIcon}
    </div>
    <div class="tool-sider" />
  </div>
  <div
    class="bar bar--right"
    style={`width: ${margin}px; right: 0; height: 100%`}
  />
  {#if showPalette}
    <div
      class="bar bar--left"
      class:show-opacity={true}
      style={`width: ${margin}px; left: 0; height: 100%`}
    >
      {#each palette as swatch, i}
        <div style="--index: {i}">
          <PaletteColor hex={swatch.hex} />
        </div>
      {/each}
    </div>
  {/if}
  <div
    class:show-opacity={hovering && !selectedTool}
    class="fab search stack-1"
    on:click={handleSearch}
  >
    {@html SearchIcon}
  </div>
  <div
    class:show-opacity={hovering && !selectedTool}
    class="fab file"
    draggable="true"
    on:dragstart={handleDragstart}
  >
    {@html FileIcon}
  </div>
  <div
    class:show-opacity={hovering && !selectedTool}
    class="fab palette stack-2"
    on:click={() => {
      showPalette = !showPalette;
    }}
  >
    {@html PaletteIcon}
  </div>
  <div class="close" on:click={handleClose}>
    {@html CloseIcon}
  </div>
  <div
    class="mover"
    style={draggable ? `-webkit-app-region: drag;` : `pointer-events: none;`}
  />
  <div class="crop" bind:this={cropEl}>
    <canvas
      bind:this={imgEl}
      on:mousedown={toolDown}
      on:mouseup={toolUp}
      on:touchstart={toolDown}
      on:touchend={toolUp}
    />
  </div>
</div>

<style>
</style>
