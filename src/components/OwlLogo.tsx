/**
 * Brand mark — the Ausculto bird. Renders public/ausculto-logo.svg (the
 * single source of truth, also used for the favicon and PWA icons) sized by
 * height so the portrait logo keeps its aspect ratio wherever it's placed.
 */
export function OwlLogo({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/ausculto-logo.svg"
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ height: size, width: 'auto' }}
    />
  );
}
