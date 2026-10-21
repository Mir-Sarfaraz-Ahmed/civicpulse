import React from "react";

export function AdminShieldIcon({ size = 24, ...props }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
      {...props}
    >
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" strokeDasharray="120" strokeDashoffset="0" opacity="1"></path>
        <path d="M6.376 18.91a6 6 0 0 1 11.249.003" opacity="1"></path>
        <circle cx="12" cy="11" r="4" opacity="1"></circle>
      </g>
    </svg>
  );
}

export function AccountIcon({ size = 24, ...props }) {
  return (
    <svg 
      width={size} 
      height={size} 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
      {...props}
    >
      <g fill="none" stroke="currentColor" strokeDasharray="28" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path d="M4 21v-1c0 -3.31 2.69 -6 6 -6h4c3.31 0 6 2.69 6 6v1">
          <animate fill="freeze" attributeName="stroke-dashoffset" dur="0.4s" values="28;0"/>
        </path>
        <path strokeDashoffset="28" d="M12 11c-2.21 0 -4 -1.79 -4 -4c0 -2.21 1.79 -4 4 -4c2.21 0 4 1.79 4 4c0 2.21 -1.79 4 -4 4Z">
          <animate fill="freeze" attributeName="stroke-dashoffset" begin="0.4s" dur="0.4s" to="0"/>
        </path>
      </g>
    </svg>
  );
}

export default { AdminShieldIcon, AccountIcon };
