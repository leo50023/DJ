import React from 'react';

interface BrandLogoProps {
  brand: string;
  logoUrl?: string | null;
  className?: string;
}

function PetronLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="40" fill="#003087" />
      <path d="M20 28h22c6.627 0 12 5.373 12 12s-5.373 12-12 12H32v10H20V28z" fill="white" />
      <path d="M32 36h9c2.209 0 4 1.791 4 4s-1.791 4-4 4h-9v-8z" fill="#003087" />
      <circle cx="40" cy="40" r="38" stroke="#FFD700" strokeWidth="2" fill="none" />
    </svg>
  );
}

function ShellLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="40" fill="#DD1D21" />
      {/* Shell shape */}
      <path
        d="M40 12 C40 12, 55 20, 60 32 C65 44, 60 56, 50 62 L40 68 L30 62 C20 56, 15 44, 20 32 C25 20, 40 12, 40 12Z"
        fill="#FFD500"
      />
      {/* Ribs */}
      <path d="M40 14 L40 66" stroke="#DD1D21" strokeWidth="2.5" />
      <path d="M31 17 C26 25, 25 42, 30 57" stroke="#DD1D21" strokeWidth="2" />
      <path d="M49 17 C54 25, 55 42, 50 57" stroke="#DD1D21" strokeWidth="2" />
      <path d="M24 30 C23 36, 23 44, 26 52" stroke="#DD1D21" strokeWidth="2" />
      <path d="M56 30 C57 36, 57 44, 54 52" stroke="#DD1D21" strokeWidth="2" />
    </svg>
  );
}

function CaltexLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="40" fill="#E31837" />
      {/* Chevron star */}
      <polygon points="40,10 46,30 68,30 51,43 57,63 40,51 23,63 29,43 12,30 34,30" fill="#FFD700" />
      <circle cx="40" cy="40" r="10" fill="#E31837" />
    </svg>
  );
}

function TotalLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="40" fill="white" stroke="#E8E8E8" strokeWidth="1" />
      {/* T-O-T-A-L letters styled as block */}
      <rect x="10" y="30" width="12" height="5" rx="1" fill="#E31837" />
      <rect x="15" y="35" width="2" height="15" rx="1" fill="#E31837" />
      <rect x="26" y="30" width="14" height="5" rx="1" fill="#E31837" />
      <rect x="26" y="35" width="6" height="10" rx="1" fill="#E31837" />
      <rect x="26" y="45" width="14" height="5" rx="1" fill="#E31837" />
      <rect x="44" y="30" width="12" height="5" rx="1" fill="#005EB8" />
      <rect x="49" y="35" width="2" height="15" rx="1" fill="#005EB8" />
      <rect x="58" y="30" width="12" height="20" rx="1" fill="#005EB8" />
      <rect x="58" y="38" width="10" height="4" rx="1" fill="white" />
    </svg>
  );
}

function SeaoilLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="40" fill="#005EB8" />
      <path d="M15 40 Q25 20 40 22 Q55 24 62 36 Q68 48 58 56 Q48 64 35 60 Q22 56 18 48 Q14 40 20 34" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="40" cy="40" r="10" fill="white" />
      <circle cx="40" cy="40" r="6" fill="#005EB8" />
      <text x="40" y="72" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="Arial">SEAOIL</text>
    </svg>
  );
}

function CleanFuelLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="40" fill="#00A651" />
      <path d="M40 15 C30 25, 20 32, 20 44 C20 56, 29 65, 40 65 C51 65, 60 56, 60 44 C60 32, 50 25, 40 15Z" fill="white" opacity="0.9" />
      <path d="M40 25 C34 32, 28 36, 28 44 C28 52, 33 59, 40 59 C47 59, 52 52, 52 44 C52 36, 46 32, 40 25Z" fill="#00A651" />
    </svg>
  );
}

function PetroDeskLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="40" fill="#0F766E" />
      {/* Fuel pump icon */}
      <rect x="22" y="24" width="22" height="28" rx="3" fill="white" />
      <rect x="26" y="28" width="14" height="10" rx="1" fill="#0F766E" />
      <rect x="44" y="28" width="6" height="16" rx="2" fill="white" />
      <rect x="48" y="22" width="4" height="8" rx="2" fill="white" />
      <circle cx="47" cy="22" r="3" fill="#FFD700" />
      <rect x="26" y="42" width="14" height="6" rx="1" fill="#0F766E" />
    </svg>
  );
}

function GenericBrandLogo({ brand, className }: { brand: string; className?: string }) {
  const initials = brand.slice(0, 2).toUpperCase();
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="40" fill="#334155" />
      <text x="40" y="47" textAnchor="middle" fill="white" fontSize="22" fontWeight="bold" fontFamily="Arial">
        {initials}
      </text>
    </svg>
  );
}

export function BrandLogo({ brand, logoUrl, className = 'w-10 h-10' }: BrandLogoProps) {
  if (logoUrl) {
    return <img src={logoUrl} alt={brand} className={`${className} object-cover`} />;
  }

  const normalized = brand.trim().toLowerCase();

  if (normalized.includes('petron')) return <PetronLogo className={className} />;
  if (normalized.includes('shell')) return <ShellLogo className={className} />;
  if (normalized.includes('caltex') || normalized.includes('chevron')) return <CaltexLogo className={className} />;
  if (normalized.includes('total') || normalized.includes('energies')) return <TotalLogo className={className} />;
  if (normalized.includes('seaoil')) return <SeaoilLogo className={className} />;
  if (normalized.includes('cleanfuel') || normalized.includes('clean fuel')) return <CleanFuelLogo className={className} />;
  if (normalized.includes('petrodesk')) return <PetroDeskLogo className={className} />;

  return <GenericBrandLogo brand={brand} className={className} />;
}
