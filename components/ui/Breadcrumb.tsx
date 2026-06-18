import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[14px] text-[#988d9f] mb-8 flex-wrap">
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-2">
          {index > 0 && (
            <span className="material-symbols-outlined text-[16px] text-[#4d4354]" aria-hidden="true">chevron_right</span>
          )}
          {item.href ? (
            <Link href={item.href} className="hover:text-[#ddb7ff] transition-colors duration-200">{item.label}</Link>
          ) : (
            <span className="text-[#e2e2e2]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
