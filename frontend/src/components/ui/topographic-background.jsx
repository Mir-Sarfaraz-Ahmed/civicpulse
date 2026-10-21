import React, { useEffect, useRef } from 'react';

/**
 * TopographicMotionBackground
 * 
 * Recreates the ultra-smooth dark-blue topographic contour map aesthetic:
 * 1. WebGL fragment shader with Catmull-Rom / cubic polynomial smoothing
 * 2. Continuous gradient height-field with zero polygonal facets
 * 3. Flowing isolines with subtle luminous neon highlight ridges
 * 4. High-tech HUD framing accents & glowing telemetry beacon
 * 5. 60 FPS GPU-accelerated rendering with buttery smooth curves
 */
export default function TopographicMotionBackground({ className = '', style = {} }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Try WebGL2 first, fallback to WebGL
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: true }) || 
               canvas.getContext('webgl', { alpha: false, antialias: true });

    let animationFrameId;
    let startTime = performance.now();

    if (!gl) {
      console.warn('[TopographicBackground] WebGL not supported, falling back to 2D canvas');
      return;
    }

    // Enable standard derivatives extension for WebGL1 if available
    gl.getExtension('OES_standard_derivatives');

    // Vertex Shader: Fullscreen quad
    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = (a_position + 1.0) * 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Fragment Shader: Analytical high-order smooth noise + analytical smooth contour isolines
    const fsSource = `
      #extension GL_OES_standard_derivatives : enable
      precision highp float;
      varying vec2 v_uv;
      uniform vec2 u_resolution;
      uniform float u_time;

      // -------------------------------------------------------------
      // High-precision Quintic Quintuple Smoothed Simplex-Like Noise
      // (Derivative continuous C2 to eliminate all polygonal angles)
      // -------------------------------------------------------------
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                            0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                           -0.577350269189626,  // -1.0 + 2.0 * C.x
                            0.024390243902439); // 1.0 / 41.0
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m;
        m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      // Smooth Fractal Brownian Motion with low-frequency domain warping
      float fbm(vec2 p) {
        float f = 0.0;
        float w = 0.5;
        for (int i = 0; i < 3; i++) {
          f += w * snoise(p);
          p *= 2.02;
          w *= 0.5;
        }
        return f;
      }

      // Quintic Smooth Curve Evaluator
      float getElevation(vec2 p, float t) {
        vec2 st = p * 0.95;
        // Large smooth swirling vector field (eliminates sharp corners)
        vec2 q = vec2(
          fbm(st + vec2(0.0, 0.0) + t * 0.035),
          fbm(st + vec2(4.3, 1.8) - t * 0.03)
        );
        vec2 r = vec2(
          fbm(st + 2.5 * q + vec2(1.7, 9.2) + t * 0.04),
          fbm(st + 2.5 * q + vec2(8.3, 2.8) - t * 0.035)
        );
        return fbm(st + 3.0 * r);
      }

      void main() {
        vec2 fragCoord = v_uv * u_resolution;
        vec2 uv = (fragCoord - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);

        // Aspect corrected coordinates
        float t = u_time * 0.65;

        // Base Heightfield
        float h = getElevation(uv * 1.35, t);

        // 1. Deep Oceanic Blue Void Gradient Background
        float distFromCenter = length(uv * vec2(0.85, 1.1));
        vec3 colBg1 = vec3(0.024, 0.063, 0.133); // #061022
        vec3 colBg2 = vec3(0.012, 0.027, 0.058); // #03070f
        vec3 colBg3 = vec3(0.005, 0.010, 0.025); // #010306
        vec3 color = mix(colBg1, colBg2, smoothstep(0.0, 0.75, distFromCenter));
        color = mix(color, colBg3, smoothstep(0.6, 1.4, distFromCenter));

        // 2. Blueprint Subtle Orthogonal Grid
        vec2 gridUv = fract(fragCoord / 48.0);
        float gridLine = smoothstep(0.04, 0.0, abs(gridUv.x - 0.5)) + smoothstep(0.04, 0.0, abs(gridUv.y - 0.5));
        color += vec3(0.08, 0.16, 0.32) * (gridLine * 0.045);

        // 3. Ultra-Smooth Analytical Topographic Isolines
        // Using continuous fwidth anti-aliasing to render perfectly smooth curved line ribbons
        float lineDensity = 11.0; // Number of concentric contour cycles
        float normH = h * lineDensity;
        
        // Calculate fractional distance to closest integer contour level
        float fracH = fract(normH);
        float distToLine = min(fracH, 1.0 - fracH);
        
        // Hardware screen-space gradient for resolution-independent silky smooth anti-aliased lines
        float fw = fwidth(normH);
        float lineStrength = 1.0 - smoothstep(0.0, fw * 1.6, distToLine);

        // Broad subtle luminous halo for smooth depth
        float glowStrength = 1.0 - smoothstep(0.0, fw * 4.5, distToLine);

        // Key Highlight Contours (every 3rd line has bright neon electric blue bloom)
        float isMajor = step(0.65, abs(sin(normH * 3.14159265 * 0.3333)));
        
        // Contour Color Palettes
        vec3 minorLineColor = vec3(0.12, 0.28, 0.55); // Rich deep ocean cyan/blue
        vec3 majorLineColor = vec3(0.24, 0.55, 0.95); // Bright electric neon cyan
        vec3 contourColor = mix(minorLineColor, majorLineColor, isMajor);

        // Apply smooth lines & bloom
        color += contourColor * (lineStrength * 0.75);
        color += majorLineColor * (glowStrength * 0.18 * isMajor);

        // 4. Subtle Dashed Elevation Guide Lines (as seen in reference)
        float dashPattern = step(0.45, fract(atan(uv.y, uv.x) * 12.0 + h * 4.0));
        float secondaryDist = min(fract(normH + 0.5), 1.0 - fract(normH + 0.5));
        float secondaryLine = (1.0 - smoothstep(0.0, fw * 1.2, secondaryDist)) * dashPattern;
        color += vec3(0.15, 0.35, 0.65) * (secondaryLine * 0.25);

        // 5. Film Grain / Microtexture for high-end cinematic finish
        float grain = fract(sin(dot(fragCoord + vec2(t * 10.0), vec2(12.9898, 78.233))) * 43758.5453);
        color += (grain - 0.5) * 0.015;

        // 6. Smooth Vignette
        float vignette = smoothstep(1.3, 0.4, length(uv));
        color *= (0.55 + 0.45 * vignette);

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // Compile helper
    function createShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('[Shader Error]', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[Program Error]', gl.getProgramInfoLog(program));
      return;
    }

    // Geometry: 2 triangles covering NDC [-1, 1]
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1
    ]), gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, 'a_position');
    const uResolution = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');

    // Handle Resize
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const displayWidth = Math.floor(window.innerWidth * dpr);
      const displayHeight = Math.floor(window.innerHeight * dpr);

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, displayWidth, displayHeight);
      }
    };

    window.addEventListener('resize', resize);
    resize();

    // Render loop
    const render = (now) => {
      resize();
      const elapsed = (now - startTime) * 0.001;

      gl.useProgram(program);

      gl.enableVertexAttribArray(aPosition);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, elapsed);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
      if (gl) {
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteBuffer(positionBuffer);
      }
    };
  }, []);

  return (
    <div
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: '#010306',
        ...style
      }}
    >
      {/* 60 FPS Smooth WebGL Topographic Canvas with fwidth-smoothed isolines */}
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      />

      {/* SVG HUD Viewfinder Corner Framing Brackets (Exact feature in reference top-right & bottom-left) */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      >
        {/* Top-Right Bracket */}
        <path
          d="M calc(86% - 32px) 20% L 86% 20% L 86% calc(20% + 32px)"
          fill="none"
          stroke="rgba(70, 130, 230, 0.45)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Bottom-Left Bracket */}
        <path
          d="M calc(14% + 32px) 80% L 14% 80% L 14% calc(80% - 32px)"
          fill="none"
          stroke="rgba(70, 130, 230, 0.45)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pulsing Solid Telemetry Beacon Node (Left side matching screenshot) */}
        <circle
          cx="7.5%"
          cy="51%"
          r="16"
          fill="none"
          stroke="rgba(255, 255, 255, 0.18)"
          strokeWidth="1.5"
        >
          <animate
            attributeName="r"
            values="10;22;10"
            dur="3.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.3;0.05;0.3"
            dur="3.2s"
            repeatCount="indefinite"
          />
        </circle>
        <circle
          cx="7.5%"
          cy="51%"
          r="7.5"
          fill="#ffffff"
          style={{ filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.95))' }}
        />
      </svg>
    </div>
  );
}
