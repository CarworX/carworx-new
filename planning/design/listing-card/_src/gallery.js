{
  // Scale each 1280 desktop board to fit its column; real size when exporting.
  const fit = () => {
    if (document.body.classList.contains("export")) return;
    for (const z of document.querySelectorAll(".zoomer")) {
      const s = z.firstElementChild;
      const k = Math.min(1, z.clientWidth / 1280);
      s.style.transform = `scale(${k})`;
      z.style.height = `${s.offsetHeight * k}px`;
    }
  };
  const ro = new ResizeObserver(fit);
  ro.observe(document.body);
  fit();
  // Cards are links to nowhere here; tapping a Verified badge toggles its list.
  document.addEventListener("click", (e) => {
    const v = e.target.closest(".vf");
    if (e.target.closest(".card")) e.preventDefault();
    if (v) v.classList.toggle("open");
  });
}
