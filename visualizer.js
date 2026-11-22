// visualizer.js - Неоновая аура под биты с динамической сменой цветов и спектром
export function makeVisualizer(audio, canvas, sleeve, auraGlow) {
  let ctx, analyser;
  const paint = canvas && canvas.getContext ? canvas.getContext("2d") : null;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  // Динамическая смена оттенка ауры
  let baseHue = 275;
  let targetHue = 275;

  function setHue(hue) {
    targetHue = hue;
  }

  function tickHue() {
    baseHue += (targetHue - baseHue) * 0.05;
    document.documentElement.style.setProperty("--aura-hue", `${baseHue}deg`);
  }

  return {
    setHue,
    start: async function (externalAudioCtx = null, externalAnalyser = null) {
      if (externalAudioCtx && externalAnalyser) {
        ctx = externalAudioCtx;
        analyser = externalAnalyser;
      } else if (!ctx) {
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
          // Fallback если MediaElementSource заблокирован CORS
          ctx = { dummy: true };
          function simDraw() {
            if (!audio.paused && !reduce.matches) {
              const t = Date.now() / 130;
              const bass = (Math.sin(t) + 1) / 2 * 0.75;
              tickHue();

              if (sleeve) {
                sleeve.style.transform = `scale(${1 + bass * 0.07})`;
                sleeve.style.boxShadow = `0 0 ${20 + bass * 55}px var(--aura-primary)`;
              }
              if (auraGlow) {
                auraGlow.style.setProperty("--aura-scale", `${1 + bass * 0.28}`);
                auraGlow.style.opacity = `${0.55 + bass * 0.4}`;
              }

              if (paint && canvas) {
                paint.clearRect(0, 0, canvas.width, canvas.height);
                for (let i = 0; i < 32; i++) {
                  const h = Math.abs(Math.sin(t + i * 0.35)) * 38;
                  paint.fillStyle = `hsl(${baseHue + (i * 2)} 85% 65%)`;
                  paint.fillRect(i * 12, 48 - h, 8, h);
                }
              }
              requestAnimationFrame(simDraw);
            }
          }
          audio.addEventListener("playing", () => { simDraw(); });
          audio.addEventListener("pause", () => {
            if (sleeve) sleeve.style.transform = "";
            if (auraGlow) { auraGlow.style.setProperty("--aura-scale", "1"); auraGlow.style.opacity = "0.4"; }
          });
          return;
        }
      }

      if (analyser) {
        const bins = new Uint8Array(analyser.frequencyBinCount);
        let frame;
        const peaks = new Float32Array(32);

        function draw() {
          analyser.getByteFrequencyData(bins);
          tickHue();

          // Басовые частоты (первые 8 бинов)
          const bass = bins.slice(0, 8).reduce((a, b) => a + b, 0) / 2040;

          if (sleeve) {
            sleeve.style.transform = `scale(${1 + bass * 0.08})`;
            sleeve.style.boxShadow = `0 0 ${25 + bass * 60}px var(--aura-primary)`;
          }

          if (auraGlow) {
            auraGlow.style.setProperty("--aura-scale", `${1 + bass * 0.35}`);
            auraGlow.style.opacity = `${0.5 + bass * 0.45}`;
          }

          if (paint && canvas) {
            paint.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < 32; i++) {
              const h = (bins[i * 3] / 255) * 46;
              paint.fillStyle = `hsl(${baseHue + (i * 2.5) - bass * 25} 90% 65%)`;
              paint.fillRect(i * 12, 48 - h, 8, h);

              peaks[i] = Math.max(h, peaks[i] - 0.7);
              if (peaks[i] > 2) {
                paint.fillStyle = "#ffffff";
                paint.fillRect(i * 12, 46 - peaks[i], 8, 2);
              }
            }
          }

          if (!reduce.matches) frame = requestAnimationFrame(draw);
        }

        audio.addEventListener("playing", () => {
          cancelAnimationFrame(frame);
          draw();
        });
        audio.addEventListener("pause", () => {
          cancelAnimationFrame(frame);
          if (sleeve) sleeve.style.transform = "";
          if (auraGlow) { auraGlow.style.setProperty("--aura-scale", "1"); auraGlow.style.opacity = "0.4"; }
        });

        // Запуск при активном воспроизведении
        if (!audio.paused) draw();
      }

      if (ctx && ctx.state === "suspended") {
        await ctx.resume().catch(() => {});
      }
    }
  };
}
