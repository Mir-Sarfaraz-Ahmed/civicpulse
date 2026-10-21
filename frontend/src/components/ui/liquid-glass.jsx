import React from "react";

// SVG Distortion Filter Component
export const GlassFilter = () => (
  <svg style={{ display: "none", position: "absolute", width: 0, height: 0 }} aria-hidden="true">
    <filter
      id="glass-distortion"
      x="0%"
      y="0%"
      width="100%"
      height="100%"
      filterUnits="objectBoundingBox"
    >
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.001 0.005"
        numOctaves="1"
        seed="17"
        result="turbulence"
      />
      <feComponentTransfer in="turbulence" result="mapped">
        <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
        <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
        <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
      </feComponentTransfer>
      <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
      <feSpecularLighting
        in="softMap"
        surfaceScale="5"
        specularConstant="1"
        specularExponent="100"
        lightingColor="white"
        result="specLight"
      >
        <fePointLight x="-200" y="-200" z="300" />
      </feSpecularLighting>
      <feComposite
        in="specLight"
        operator="arithmetic"
        k1="0"
        k2="1"
        k3="1"
        k4="0"
        result="litImage"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="softMap"
        scale="40"
        xChannelSelector="R"
        yChannelSelector="G"
      />
    </filter>
  </svg>
);

// Glass Effect Wrapper Component
export const GlassEffect = ({
  children,
  className = "",
  style = {},
  href,
  target = "_blank",
  dark = true,
  glowColor,
  interactive = false,
}) => {
  const glassStyle = {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    borderRadius: "20px",
    overflow: "hidden",
    backdropFilter: "blur(24px) saturate(160%)",
    WebkitBackdropFilter: "blur(24px) saturate(160%)",
    boxShadow: glowColor 
      ? `0 18px 45px -10px rgba(0, 0, 0, 0.65), 0 0 25px ${glowColor}, inset 0 1px 1px 0 rgba(255, 255, 255, 0.25)`
      : "0 18px 45px -10px rgba(0, 0, 0, 0.55), inset 0 1px 1px 0 rgba(255, 255, 255, 0.2)",
    transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 1.4)",
    transition: "all 0.35s ease",
    border: "1px solid rgba(255, 255, 255, 0.14)",
    ...style,
  };

  const content = (
    <div
      className={`glass-effect-card ${interactive ? 'glass-card-interactive' : ''} ${className}`}
      style={glassStyle}
    >
      {/* 1. Liquid Glass Refractive Filter Layer */}
      <div
        className="glass-distortion-layer"
        style={{
          position: "absolute",
          inset: 0,
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          filter: "url(#glass-distortion)",
          isolation: "isolate",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      
      {/* 2. Glass Body Tint Layer */}
      <div
        className="glass-tint-layer"
        style={{
          position: "absolute",
          inset: 0,
          background: dark 
            ? "linear-gradient(135deg, rgba(12, 18, 38, 0.60) 0%, rgba(6, 9, 22, 0.72) 100%)" 
            : "rgba(255, 255, 255, 0.25)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* 3. Double Specular Liquid Rim Highlight */}
      <div
        className="glass-specular-rim"
        style={{
          position: "absolute",
          inset: 0,
          boxShadow:
            "inset 2px 2px 1px 0 rgba(255, 255, 255, 0.35), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.12)",
          borderRadius: "inherit",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {/* 4. Foreground Content */}
      <div style={{ position: "relative", zIndex: 10, width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );

  return href ? (
    <a href={href} target={target} rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
      {content}
    </a>
  ) : (
    content
  );
};

// Dock Component
export const GlassDock = ({ icons = [], href }) => (
  <GlassEffect
    href={href}
    style={{ borderRadius: "24px", padding: "12px" }}
  >
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", overflow: "hidden" }}>
      {icons.map((icon, index) => (
        <img
          key={index}
          src={icon.src}
          alt={icon.alt}
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "14px",
            transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 2.2)",
            transformOrigin: "center center",
            cursor: "pointer",
          }}
          onClick={icon.onClick}
        />
      ))}
    </div>
  </GlassEffect>
);

// Button Component
export const GlassButton = ({ children, href, onClick, style = {} }) => (
  <GlassEffect
    href={href}
    style={{ borderRadius: "20px", padding: "14px 28px", cursor: "pointer", ...style }}
  >
    <div
      onClick={onClick}
      style={{
        transition: "all 0.3s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
      }}
    >
      {children}
    </div>
  </GlassEffect>
);

// Default Component Demo
export const Component = () => (
  <div
    style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
      width: "100%",
      padding: "20px",
    }}
  >
    <GlassFilter />

    <div style={{ display: "flex", flexDirection: "column", gap: "24px", alignItems: "center", width: "100%", maxWidth: "600px" }}>
      <GlassButton>
        <div style={{ fontSize: "1.2rem", color: "#ffffff" }}>
          How can I help you today?
        </div>
      </GlassButton>
    </div>
  </div>
);

export default GlassEffect;
