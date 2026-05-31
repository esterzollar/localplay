import React from 'react';

export default function PlaylistPlaceholder({ playlistId, title }) {
  const index = Math.abs(playlistId || 0) % 10;
  const initial = (title || 'P').charAt(0).toUpperCase();

  const gradients = [
    { from: '#ff5e62', to: '#ff9966' }, // Sunset Crimson
    { from: '#00c6ff', to: '#0072ff' }, // Deep Ocean
    { from: '#f80759', to: '#bc4e9c' }, // Neon Purple
    { from: '#11998e', to: '#38ef7d' }, // Emerald Breeze
    { from: '#7F00FF', to: '#E100FF' }, // Electric Violet
    { from: '#f12711', to: '#f5af19' }, // Lava Orange
    { from: '#3a7bd5', to: '#3a6073' }, // Forest Glow
    { from: '#ec008c', to: '#fc6767' }, // Cyber Pink
    { from: '#232526', to: '#414345' }, // Midnight Gold
    { from: '#1d976c', to: '#93f9b9' }  // Aqua Marine
  ];

  const grad = gradients[index];
  const gradId = `playlist-grad-${index}-${playlistId}`;

  return (
    <svg 
      width="100%" 
      height="100%" 
      viewBox="0 0 160 90" 
      preserveAspectRatio="none" 
      style={{ display: 'block', borderRadius: 'inherit' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={grad.from} />
          <stop offset="100%" stopColor={grad.to} />
        </linearGradient>
      </defs>
      
      {/* Background */}
      <rect width="160" height="90" fill={`url(#${gradId})`} />

      {/* Decorative patterns based on index */}
      {index === 0 && (
        <circle cx="140" cy="20" r="40" fill="white" fillOpacity="0.08" />
      )}
      {index === 1 && (
        <rect x="-20" y="40" width="80" height="80" rx="10" transform="rotate(45)" fill="white" fillOpacity="0.06" />
      )}
      {index === 2 && (
        <path d="M 0,90 Q 40,40 80,90 T 160,90" fill="white" fillOpacity="0.08" />
      )}
      {index === 3 && (
        <polygon points="0,0 80,0 40,80" fill="white" fillOpacity="0.06" />
      )}
      {index === 4 && (
        <rect x="30" y="-30" width="100" height="100" rx="50" fill="white" fillOpacity="0.05" />
      )}
      {index === 5 && (
        <path d="M-10,45 Q80,-15 170,45" fill="none" stroke="white" strokeWidth="3" strokeOpacity="0.1" />
      )}
      {index === 6 && (
        <circle cx="30" cy="70" r="50" fill="white" fillOpacity="0.07" />
      )}
      {index === 7 && (
        <rect x="110" y="50" width="60" height="60" rx="8" transform="rotate(15)" fill="white" fillOpacity="0.06" />
      )}
      {index === 8 && (
        <path d="M0,0 L160,90 M160,0 L0,90" stroke="white" strokeWidth="1.5" strokeOpacity="0.04" />
      )}
      {index === 9 && (
        <circle cx="80" cy="45" r="30" fill="white" fillOpacity="0.05" />
      )}

      {/* Playlist Icon overlay (Lines + play triangle) */}
      <g transform="translate(16, 25)" fill="white" fillOpacity="0.8">
        <rect x="0" y="0" width="22" height="2.5" rx="1" />
        <rect x="0" y="6" width="22" height="2.5" rx="1" />
        <rect x="0" y="12" width="12" height="2.5" rx="1" />
        <polygon points="16,12 16,20 22,16" />
      </g>

      {/* Stylized Monogram initial */}
      <text
        x="132"
        y="58"
        fill="white"
        fillOpacity="0.85"
        fontSize="32"
        fontWeight="800"
        fontFamily="'Roboto', 'Segoe UI', sans-serif"
        textAnchor="middle"
      >
        {initial}
      </text>
    </svg>
  );
}
