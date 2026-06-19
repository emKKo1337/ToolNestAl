import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-[#6b5b7a] mb-8 flex-wrap">
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1.5 min-w-0">
          {index > 0 && (
            <span className="material-symbols-outlined text-[14px] text-[#3d3347] flex-shrink-0" aria-hidden="true">
              chevron_right
            </span>
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-[#ddb7ff] transition-colors duration-200 truncate max-w-[120px] sm:max-w-none"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-[#cfc2d6] font-medium truncate">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
