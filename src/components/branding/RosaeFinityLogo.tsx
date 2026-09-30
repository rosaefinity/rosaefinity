import React from "react";
interface RosaeFinityLogoProps {
  className?: string;
  size?: number;
}

// Relative path: works in both Vite dev server (serves public/ at root)
// and Electron production (resolves relative to dist/index.html inside asar)
const LOGO_SRC = './logo-rosaefinity-transparent.png';

export function RosaeFinityLogo({ className = '', size }: RosaeFinityLogoProps): React.JSX.Element {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <img
      src={LOGO_SRC}
      alt="RosaeFinity"
      className={`object-contain ${className}`}
      style={style}
    />
  );
}
