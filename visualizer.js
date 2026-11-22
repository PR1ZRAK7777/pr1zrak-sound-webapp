export function makeVisualizer(audio, canvas, sleeve) {
  let ctx, analyser;
  const paint = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  return async function start() {
    if (!ctx) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          ctx = new AudioContextClass();
          analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          const source = ctx.createMediaElementSource(audio);
          source.connect(analyser);
          analyser.connect(ctx.destination);
        }
      } catch (err) {
        // Fallback for CORS or browser security restrictions:
        ctx = { dummy: true };
        function simDraw() {
          if (!audio.paused && !reduce.matches) {
            const t = Date.now() / 140;
            const bass = (Math.sin(t) + 1) / 2 * 0.8;
            sleeve.style.transform = "scale(" + (1 + bass * 0.08) + ")";
            sleeve.style.boxShadow = "0 0 " + (20 + bass * 45) + "px hsl(" + (275 - bass * 65) + " 80% 55% / .7)";
            paint.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < 32; i++) {
              const h = Math.abs(Math.sin(t + i * 0.3)) * 40;
              paint.fillStyle = "hsl(" + (275 + 85 * i / 31) + " 80% 65%)";
              paint.fillRect(i * 12, 52 - h, 8, h);
            }
            requestAnimationFrame(simDraw);
          }
        }
        audio.addEventListener("playing", () => { simDraw(); });
        audio.addEventListener("pause", () => { sleeve.style.transform = ""; });
        return;
      }

      if (analyser) {
        const bins = new Uint8Array(analyser.frequencyBinCount);
        let frame;
        const peaks = new Float32Array(32);
        function draw() {
          analyser.getByteFrequencyData(bins);
          paint.clearRect(0, 0, canvas.width, canvas.height);
          const bass = bins.slice(0, 10).reduce((a, b) => a + b, 0) / 2550;
          for (let i = 0; i < 32; i++) {
            const h = (bins[i * 3] / 255) * 50;
            paint.fillStyle = "hsl(" + (275 + (85 * i) / 31 - bass * 35) + " 80% 65%)";
            paint.fillRect(i * 12, 52 - h, 8, h);
            peaks[i] = Math.max(h, peaks[i] - 0.7);
            if (peaks[i] > 2) {
              paint.fillStyle = "#e5d1ff";
              paint.fillRect(i * 12, 50 - peaks[i], 8, 2);
            }
          }
          sleeve.style.transform = "scale(" + (1 + bass * 0.08) + ")";
          sleeve.style.boxShadow = "0 0 " + (20 + bass * 45) + "px hsl(" + (275 - bass * 65) + " 80% 55% / .7)";
          if (!audio.paused && !reduce.matches) frame = requestAnimationFrame(draw);
        }
        audio.addEventListener("playing", () => { cancelAnimationFrame(frame); draw(); });
        audio.addEventListener("pause", () => { cancelAnimationFrame(frame); sleeve.style.transform = ""; });
      }
    }
    if (ctx && ctx.state === "suspended") {
      await ctx.resume().catch(() => {});
    }
  };
}
