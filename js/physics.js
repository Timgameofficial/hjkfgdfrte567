/* physics.js — spring physics engine.
   Gives the ball visual "mass": it lags behind motion, overshoots slightly,
   and settles with damping, instead of snapping instantly to a target.
   Also owns the per-frame loop that drives ball tilt (gyroscope + touch)
   and the moving glass highlight (spec §5, §10, §11, §13). */
(function (global) {

  // ---- generic 1D spring (semi-implicit Euler, frame-rate independent) ----
  function createSpring({ value = 0, stiffness = 170, damping = 18, mass = 1 } = {}) {
    let pos = value, vel = 0, target = value;
    return {
      set(t) { target = t; },
      jump(v) { pos = v; target = v; vel = 0; },
      update(dt) {
        // clamp dt so a dropped/backgrounded tab doesn't cause a huge jump
        dt = Math.min(dt, 1 / 20);
        const force = -stiffness * (pos - target) - damping * vel;
        const acc = force / mass;
        vel += acc * dt;
        pos += vel * dt;
        return pos;
      },
      get value() { return pos; },
      get velocity() { return vel; },
      settled() { return Math.abs(vel) < 0.001 && Math.abs(pos - target) < 0.001; }
    };
  }

  // ---- 2D convenience wrapper (used for ball tilt & highlight position) ----
  function createSpring2D(opts) {
    const sx = createSpring(opts);
    const sy = createSpring(opts);
    return {
      set(x, y) { sx.set(x); sy.set(y); },
      jump(x, y) { sx.jump(x); sy.jump(y); },
      update(dt) { return { x: sx.update(dt), y: sy.update(dt) }; },
      get value() { return { x: sx.value, y: sy.value }; }
    };
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  // =====================================================================
  // BALL RIG — combines gyroscope tilt + touch/mouse drag + shake jitter
  // into one spring-driven transform, applied to #ball every frame.
  // =====================================================================
  const MAX_TILT_DEG = 7; // spec §11: keep it subtle, 5-8 degrees max
  const MAX_TOUCH_TILT_DEG = 10;

  const tilt = createSpring2D({ stiffness: 120, damping: 14 });   // deg
  const highlightPos = createSpring2D({ stiffness: 90, damping: 12, value: 0 }); // -1..1 space
  const breatheSpring = createSpring({ stiffness: 40, damping: 10 });

  let gyroTarget = { x: 0, y: 0 };
  let touchTarget = { x: 0, y: 0 };
  let touchActive = false;
  let jitterTarget = { x: 0, y: 0 };
  let shakeIntensityRef = 0; // read live from MBShake if present

  let ballEl = null, highlightEl = null, highlight2El = null, wrapEl = null;
  let running = false;
  let lastT = 0;
  let breatheClock = 0;

  function onGyro(nx, ny) {
    // phone tilted right -> ball answers by leaning the other way (spec §11)
    gyroTarget.x = clamp(-ny, -1, 1) * MAX_TILT_DEG;
    gyroTarget.y = clamp(nx, -1, 1) * MAX_TILT_DEG;
  }

  function onTouchDrag(nx, ny, active) {
    touchActive = active;
    touchTarget.x = clamp(-ny, -1, 1) * MAX_TOUCH_TILT_DEG;
    touchTarget.y = clamp(nx, -1, 1) * MAX_TOUCH_TILT_DEG;
  }

  function setShakeIntensity(v) {
    shakeIntensityRef = v;
    // random micro-jitter grows with shake intensity, giving the "mass"
    // something to react against instead of a clean sine wave
    const amp = v * 4;
    jitterTarget.x = (Math.random() - 0.5) * amp;
    jitterTarget.y = (Math.random() - 0.5) * amp;
  }

  function frame(t) {
    if (!running) return;
    const dt = lastT ? (t - lastT) / 1000 : 1 / 60;
    lastT = t;

    // combine sources: touch overrides gyro while active, shake adds jitter on top
    const baseTarget = touchActive
      ? touchTarget
      : { x: gyroTarget.x + jitterTarget.x, y: gyroTarget.y + jitterTarget.y };
    tilt.set(baseTarget.x, baseTarget.y);
    const t2 = tilt.update(dt);

    highlightPos.set(baseTarget.x / MAX_TILT_DEG, baseTarget.y / MAX_TILT_DEG);
    const h = highlightPos.update(dt);

    breatheClock += dt;
    const breathe = Math.sin(breatheClock * (Math.PI * 2) / 6) * 0.5 + 0.5; // 0..1 over 6s

    if (ballEl) {
      const liftPx = -6 * breathe - shakeIntensityRef * 3;
      const scale = 1 + 0.015 * breathe + shakeIntensityRef * 0.03;
      ballEl.style.transform =
        `perspective(900px) translateY(${liftPx.toFixed(2)}px) scale(${scale.toFixed(4)}) ` +
        `rotateX(${(-t2.y).toFixed(2)}deg) rotateY(${t2.x.toFixed(2)}deg)`;
    }
    if (highlightEl) {
      highlightEl.style.left = (18 + h.x * 10).toFixed(2) + '%';
      highlightEl.style.top = (8 + h.y * 10).toFixed(2) + '%';
    }
    if (highlight2El) {
      // second highlight drifts opposite, at a different depth (parallax, spec §12)
      highlight2El.style.left = (68 - h.x * 6).toFixed(2) + '%';
      highlight2El.style.top = (60 - h.y * 6).toFixed(2) + '%';
    }
    if (wrapEl) {
      wrapEl.style.setProperty('--rim-angle', (Math.atan2(h.y, h.x) * 180 / Math.PI + 90) + 'deg');
    }

    requestAnimationFrame(frame);
  }

  function start(refs) {
    ballEl = refs.ball; highlightEl = refs.highlight; highlight2El = refs.highlight2; wrapEl = refs.wrap;
    if (running) return;
    running = true;
    lastT = 0;
    requestAnimationFrame(frame);
  }

  function releaseTouch() {
    touchActive = false;
  }

  global.MBPhysics = {
    createSpring, createSpring2D,
    start, onGyro, onTouchDrag, releaseTouch, setShakeIntensity
  };
})(window);
