const { ipcRenderer } = require("electron");

ipcRenderer.on("SET_SOURCE", async (event, encoded) => {
  let img = document.querySelector("img");
  img.src = "snip://" + encoded.index + ".png";
  img.style.width = encoded.width + "px";
  img.style.height = encoded.height + "px";

  let cropper = document.querySelector(".cropper");

  let startX = 0;
  let startY = 0;
  let isDragging = false;
  let endX = 0;
  let endY = 0;

  document.addEventListener("mousedown", (e) => {
    startX = e.clientX;
    startY = e.clientY;
    cropper.style.left = startX + "px";
    cropper.style.top = startY + "px";
    cropper.style.width = 0;
    cropper.style.height = 0;
    isDragging = true;
  });

  document.addEventListener("mouseup", (e) => {
    isDragging = false;

    let minX = Math.min(startX, endX);
    let minY = Math.min(startY, endY);
    let maxX = Math.max(startX, endX);
    let maxY = Math.max(startY, endY);

    ipcRenderer.invoke("SNIP", {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    });
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      endX = e.clientX;
      endY = e.clientY;

      let minX = Math.min(startX, endX);
      let minY = Math.min(startY, endY);
      let maxX = Math.max(startX, endX);
      let maxY = Math.max(startY, endY);

      cropper.style.left = minX + "px";
      cropper.style.top = minY + "px";
      cropper.style.width = maxX - minX + "px";
      cropper.style.height = maxY - minY + "px";
      console.log(startX, endX);
    }
  });
});
