/**
 * The Focus Room backdrop. The blur is a CSS filter on the image layer only, so the stored image stays
 * untouched and nothing drawn above it (timer, controls) is affected. The layer is oversized while
 * blurred so the filter never fades the edges into a visible border.
 */
export function FocusBackground({ image, blur }: { image: string; blur: number }) {
  const bleed = blur * 2;
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt=""
        draggable={false}
        data-testid="focus-bg-image"
        className="pointer-events-none absolute max-w-none object-cover object-center"
        style={{ top: -bleed, left: -bleed, width: `calc(100% + ${bleed * 2}px)`, height: `calc(100% + ${bleed * 2}px)`, filter: blur ? `blur(${blur}px)` : "none", WebkitFilter: blur ? `blur(${blur}px)` : "none", transform: "translate3d(0,0,0)", willChange: blur ? "filter" : "auto" }}
      />
    </div>
  );
}
