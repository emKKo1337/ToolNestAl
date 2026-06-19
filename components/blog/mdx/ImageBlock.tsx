export function ImageBlock({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  return (
    <figure className="my-8">
      <div className="rounded-2xl overflow-hidden glass-panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="w-full h-auto block"
          loading="lazy"
        />
      </div>
      {caption && (
        <figcaption className="text-center text-[12px] text-[#6b5b7a] mt-2 leading-snug">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
