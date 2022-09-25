const { ipcRenderer } = require("electron");

ipcRenderer.on("SET_SOURCE", async (event, encoded) => {
  let img = document.querySelector("img");
  img.src = "snip://" + encoded.index + ".png";
  img.style.width = encoded.width + "px";
  img.style.height = encoded.height + "px";

  let color = document.querySelector(".color");
  let tooltip = document.querySelector(".tooltip");
  let glass = document.querySelector(".glass");
  let ctx = glass.getContext("2d");

  let glassSize = 100;
  let glassDiv = 10;
  let pickerX = 0;
  let pickerY = 0;
  let isDragging = false;

  function setPickerLocation(clientX, clientY) {
    let rect = img.getBoundingClientRect();

    pickerX = clientX;
    pickerY = clientY;
    renderGlass();
  }

  function renderGlass() {
    let tx = Math.floor(pickerX);
    let ty = Math.floor(pickerY);
    glass.style.left = tx - (glassSize / 2) * encoded.factor + "px";
    glass.style.top = ty - (glassSize / 2) * encoded.factor + "px";
    glass.style.width = glassSize * encoded.factor + "px";
    glass.style.height = glassSize * encoded.factor + "px";
    let rect = glass.getBoundingClientRect();
    tooltip.style.left = rect.left + rect.width / 2 - 130 / 2 + "px";
    tooltip.style.top = rect.top + rect.height + 10 + "px";

    if (rect.top + rect.height + 10 + 60 > window.innerHeight) {
      tooltip.style.top = rect.top - 10 - 60 + "px";
    }
    glass.width = glassSize;
    glass.height = glassSize;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      img,
      tx - glassSize / glassDiv / 2 - 0.5,
      ty - glassSize / glassDiv / 2 - 0.5,
      glassSize / glassDiv,
      glassSize / glassDiv,
      0,
      0,
      glassSize,
      glassSize
    );
    ctx.rect(
      glassSize / 2 - glassDiv / 2,
      glassSize / 2 - glassDiv / 2,
      glassDiv,
      glassDiv
    );
    ctx.strokeStyle = "white";
    ctx.stroke();
  }

  document.addEventListener("keydown", (e) => {
    console.log(e.key);
    if (e.key == "Escape") {
      ipcRenderer.invoke("close");
    }

    if (e.key.startsWith("Arrow")) {
      let dx = 0;
      let dy = 0;
      if (e.key == "ArrowLeft") {
        dx = -1;
      } else if (e.key == "ArrowRight") {
        dx = 1;
      } else if (e.key == "ArrowUp") {
        dy = -1;
      } else if (e.key == "ArrowDown") {
        dy = 1;
      }

      pickerX += dx;
      pickerY += dy;
      renderGlass();
    }
  });

  document.addEventListener("mousedown", (e) => {
    isDragging = true;
  });

  document.addEventListener("wheel", (e) => {
    console.log(e.deltaY);
    if (e.shiftKey) {
      glassDiv = Math.min(100, Math.max(1, glassDiv + Math.sign(e.deltaY)));
    } else {
      glassSize = Math.min(
        300,
        Math.max(10, glassSize + Math.sign(e.deltaY) * 10)
      );
    }
    renderGlass();
  });

  function getPixelHex(x, y) {
    let data = ctx.getImageData(glassSize / 2, glassSize / 2, 1, 1).data;
    console.log(data);
    return (
      "#" +
      ((1 << 24) + (data[0] << 16) + (data[1] << 8) + data[2])
        .toString(16)
        .slice(1)
    );
  }

  document.addEventListener("mouseup", (e) => {
    isDragging = false;

    let hex = getPixelHex(pickerX, pickerY);

    navigator.clipboard.writeText(hex);

    if (e.button == 2) {
      ipcRenderer.invoke("pickColor", {
        hex,
      });
    } else {
      setTimeout(() => {
        ipcRenderer.invoke("close");
      }, 10);
    }
  });

  document.addEventListener("mousemove", (e) => {
    console.log(e);
    if (e.shiftKey) {
      pickerX += e.movementX / 10;
      pickerY += e.movementY / 10;
      renderGlass();
    } else {
      setPickerLocation(e.clientX, e.clientY);
    }
  });
});
