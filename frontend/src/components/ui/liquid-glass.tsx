"use client";

import React from "react";

// Types
export interface GlassEffectProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  href?: string;
  target?: string;
  dark?: boolean;
  glowColor?: string;
}

export interface DockIcon {
  src: string;
  alt: string;
  onClick?: () => void;
}

// SVG Distortion Filter Component
export const GlassFilter: React.FC = () => (
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
export const GlassEffect: React.FC<GlassEffectProps> = ({
  children,
  className = "",
  style = {},
  href,
  target = "_blank",
  dark = true,
  glowColor,
}) => {
  const glassStyle: React.CSSProperties = {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    borderRadius: "20px",
    overflow: "hidden",
    boxShadow: glowColor 
      ? `0 18px 45px -10px rgba(0, 0, 0, 0.65), 0 0 25px ${glowColor}, inset 0 1px 1px 0 rgba(255, 255, 255, 0.25)`
      : "0 18px 45px -10px rgba(0, 0, 0, 0.55), inset 0 1px 1px 0 rgba(255, 255, 255, 0.2)",
    transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 1.4)",
    transition: "all 0.4s ease",
    border: "1px solid rgba(255, 255, 255, 0.14)",
    ...style,
  };

  const content = (
    <div
      className={`relative overflow-hidden cursor-default transition-all duration-700 ${className}`}
      style={glassStyle}
    >
      {/* 1. Liquid Glass Refractive Filter Layer */}
      <div
        className="absolute inset-0 z-0 overflow-hidden"
        style={{
          position: "absolute",
          inset: 0,
          backdropFilter: "blur(18px) saturate(160%)",
          WebkitBackdropFilter: "blur(18px) saturate(160%)",
          filter: "url(#glass-distortion)",
          isolation: "isolate",
          pointerEvents: "none",
        }}
      />
      
      {/* 2. Glass Body Tint Layer */}
      <div
        className="absolute inset-0 z-10"
        style={{
          position: "absolute",
          inset: 0,
          background: dark 
            ? "linear-gradient(135deg, rgba(18, 24, 48, 0.86) 0%, rgba(9, 13, 28, 0.92) 100%)" 
            : "rgba(255, 255, 255, 0.25)",
          pointerEvents: "none",
        }}
      />

      {/* 3. Double Specular Liquid Rim Highlight */}
      <div
        className="absolute inset-0 z-20 pointer-events-none"
        style={{
          position: "absolute",
          inset: 0,
          boxShadow:
            "inset 2px 2px 1px 0 rgba(255, 255, 255, 0.35), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.12)",
          borderRadius: "inherit",
          pointerEvents: "none",
        }}
      />

      {/* 4. Foreground Content */}
      <div className="relative z-30" style={{ position: "relative", zIndex: 30, width: "100%", height: "100%" }}>
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
export const GlassDock: React.FC<{ icons: DockIcon[]; href?: string }> = ({
  icons,
  href,
}) => (
  <GlassEffect
    href={href}
    className="rounded-3xl p-3 hover:p-4 hover:rounded-4xl"
  >
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "12px", overflow: "hidden" }}>
      {icons.map((icon, index) => (
        <img
          key={index}
          src={icon.src}
          alt={icon.alt}
          style={{
            width: "64px",
            height: "64px",
            transition: "all 0.7s cubic-bezier(0.175, 0.885, 0.32, 2.2)",
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
export const GlassButton: React.FC<{ children: React.ReactNode; href?: string }> = ({
  children,
  href,
}) => (
  <GlassEffect
    href={href}
    className="rounded-3xl px-10 py-6 hover:px-11 hover:py-7 hover:rounded-4xl overflow-hidden"
  >
    <div
      style={{
        transition: "all 0.7s cubic-bezier(0.175, 0.885, 0.32, 2.2)",
      }}
    >
      {children}
    </div>
  </GlassEffect>
);

// Default Component Demo
export const Component = () => {
  const dockIcons: DockIcon[] = [
    {
      src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&q=80",
      alt: "Abstract 1",
    },
    {
      src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&q=80",
      alt: "Abstract 2",
    },
  ];

  return (
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
        <GlassDock icons={dockIcons} />

        <GlassButton>
          <div style={{ fontSize: "1.2rem", color: "#ffffff" }}>
            <p>How can I help you today?</p>
          </div>
        </GlassButton>
      </div>
    </div>
  );
};

export default GlassEffect;
