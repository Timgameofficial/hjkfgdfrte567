/* physics.js — lightweight spring physics for a believable "physical" ball feel */
(function (global) {

  class Spring {
    constructor({ stiffness = 160, damping = 16, mass = 1 } = {}) {
      this.stiffness = stiffness;
      this.damping = damping;
      this.mass = mass;
      this.pos = 0;
      this.vel = 0;
      this.target = 0;
    }
    step(dt) {
      const force = -this.stiffness * (this.pos - this.target) - this.damping * this.vel;
      const accel = force / this.mass;
      this.vel += accel * dt;
      this.pos += this.vel * dt;
      return this.pos;
    }
    kick(velocityDelta) { this.vel += velocityDelta; }
    setTarget(v) { this.target = v; }
    settle(v) { this.pos = v; this.vel = 0; this.target = v; }
  }

  // ---- ball physics manager ----
  let ballEl = null;
  let springX = new Spring({ stiffness: 120, damping: 14, mass: 1 });   // px offset
  let springY = new Spring({ stiffness: 120, damping: 14, mass: 1 });   // px offset
  let springRot = new Spring({ stiffness: 90, damping: 10, mass: 1 });  // deg tilt
  let springScale = new Spring({ stiffness: 140, damping: 12, mass: 1 }); // scale delta

  let gyroTargetRot = 0;
  let dragOffset = { x: 0, y: 0, active: false };
  let lastFrame = performance.now();

  function init(el) {
    ballEl = el;
    springScale.settle(0);
    requestAnimationFrame(loop);
  }

  function setGyroTilt(rotDeg) {
    gyroTargetRot = Math.max(-8, Math.min(8, rotDeg));
  }

  function setDragOffset(x, y) {
    dragOffset.active = true;
    dragOffset.x = Math.max(-18, Math.min(18, x));
    dragOffset.y = Math.max(-18, Math.min(18, y));
  }
  function clearDrag() { dragOffset.active = false; }

  // shake impulse: kicks the spring like a real object being jolted
  function kickShake(intensity = 0.5) {
    const sign = Math.random() > 0.5 ? 1 : -1;
    springRot.kick(sign * intensity * 260);
    springX.kick((Math.random() - 0.5) * intensity * 220);
    springY.kick((Math.random() - 0.5) * intensity * 160);
    springScale.kick(intensity * 3.2);
  }

  function pulseScale(delta) {
    springScale.kick(delta * 5);
  }

  function loop(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    // ambient "breathing" — replaces the old CSS keyframe animation so the
    // physics engine has exclusive, non-conflicting control of .ball's transform
    const breath = Math.sin(now / 1000 * (Math.PI * 2 / 6));

    // combine drag (immediate target) + gyro (ambient target) for rotation
    springRot.setTarget(dragOffset.active ? dragOffset.x * 0.4 : gyroTargetRot);
    springX.setTarget(dragOffset.active ? dragOffset.x : 0);
    springY.setTarget((dragOffset.active ? dragOffset.y * 0.5 : 0) - breath * 4);
    springScale.setTarget(breath * 1.2);

    const x = springX.step(dt);
    const y = springY.step(dt);
    const rot = springRot.step(dt);
    const scale = 1 + springScale.step(dt) * 0.01;

    if (ballEl) {
      ballEl.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
    }
    requestAnimationFrame(loop);
  }

  global.MBPhysics = { Spring, init, setGyroTilt, setDragOffset, clearDrag, kickShake, pulseScale };
})(window);
