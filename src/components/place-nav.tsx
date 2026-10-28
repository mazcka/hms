export function PlaceNav({ place }: { place: string }) {
  const href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}`;
  return (
    <div className="place-nav">
      <span>{place}</span>
      <a className="maps-link" href={href} target="_blank" rel="noopener noreferrer">
        <GoogleMapsMark />
        <span className="meta">ניווט</span>
      </a>
    </div>
  );
}

function GoogleMapsMark() {
  return (
    <svg viewBox="0 0 48 48" width="28" height="28" aria-hidden="true">
      <path fill="#48b564" d="M35.76 26.36h.01s-3.77 5.53-6.94 9.64c-2.74 3.55-3.54 6.59-3.77 8.06C24.97 44.6 24.53 45 24 45s-.97-.4-1.06-.94c-.23-1.47-1.03-4.51-3.77-8.06-.42-.55-.85-1.12-1.28-1.7L28.24 22l8.33-9.88C37.49 14.05 38 16.21 38 18.5c0 2.9-.83 5.59-2.24 7.86z" />
      <path fill="#fcc60e" d="M28.24 22 17.89 34.3c-2.82-3.78-5.66-7.94-5.66-7.94h.01c-.3-.48-.57-.97-.8-1.48L19.76 15c.79.95 6.08 7.1 8.48 7z" />
      <path fill="#2c85eb" d="M28.4 4.74 19.83 14.92 13.27 9.2C15.83 6.02 19.69 4 24 4c1.54 0 3.02.26 4.4.74z" />
      <path fill="#ed5748" d="M28.4 4.74C30.68 5.64 32.7 7.14 34.32 9.02L28.24 22h-.01c-2.4.1-7.69-6.05-8.48-7L28.4 4.74z" />
      <path fill="#5695f6" d="m28.24 22 5.96-7.07c.87 1.45 1.5 3.09 1.8 4.82 0 0-1.96 1.74-4.04 3.67-1.06.88-2.47-.3-3.72-1.42z" />
    </svg>
  );
}
