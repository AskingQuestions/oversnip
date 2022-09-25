const { ipcRenderer } = require("electron");

ipcRenderer.on("SET_SOURCE", async (event, data) => {
  let card = document.querySelector(".card");
  card.style.backgroundColor = data.hex;
  card.innerHTML = `<span>${data.hex}</span>`;

  document.querySelector(".close-card").addEventListener("click", () => {
    window.close();
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest(".card")) {
      navigator.clipboard.writeText(data.hex);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key == "Escape") {
      ipcRenderer.invoke("close");
    }
  });
});
