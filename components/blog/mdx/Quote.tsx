export function Quote({
  children,
  author,
}: {
  children: React.ReactNode;
  author?: string;
}) {
  return (
    <blockquote
      className="my-6 pl-5 py-1"
      style={{ borderLeft: "3px solid #ddb7ff" }}
    >
      <div className="text-[16px] leading-[28px] text-[#cfc2d6] italic">
        {children}
      </div>
      {author && (
        <cite className="block text-[13px] text-[#6b5b7a] mt-2 not-italic font-medium">
          — {author}
        </cite>
      )}
    </blockquote>
  );
}
