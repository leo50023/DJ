export function formatPeso(value: number): string {
  const num = Number.isFinite(value) ? value : 0;
  return `₱${num.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatLiters(value: number, decimals = 2): string {
  const num = Number.isFinite(value) ? value : 0;
  return `${num.toLocaleString('en-PH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} L`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  });
}

export function roleLabel(role: string): string {
  if (role === 'ADMIN') return 'Administrator';
  if (role === 'MANAGER') return 'Station Manager';
  return 'Cashier';
}
