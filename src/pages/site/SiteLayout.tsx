import { useState, type ReactNode } from 'react';
import type { Route } from '../../lib/router';
import { Icon, Wordmark } from '../../components/icons';

const NAV = [
  { href: '#home', key: 'home', label: 'Giới thiệu' },
  { href: '#explorer', key: 'explorer', label: 'Trạm RE' },
  { href: '#pilot', key: 'pilot', label: 'Thí điểm & lộ trình' },
  { href: '#hub', key: 'hub', label: 'RE Hub' },
];

export function SiteLayout({ route, children }: { route: Route; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-paper/95">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#home" className="rounded-sm" aria-label="RE, trang chủ">
            <Wordmark sub="Thu hồi chai PET" />
          </a>
          <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <a
                key={n.key}
                href={n.href}
                aria-current={route.name === n.key ? 'page' : undefined}
                className={`rounded-sm px-3 py-2 text-sm font-medium transition-colors ${route.name === n.key ? 'text-ink underline decoration-lime decoration-2 underline-offset-[6px]' : 'text-ink-2 hover:text-ink'}`}
              >
                {n.label}
              </a>
            ))}
            <a href="#app-return" className="btn btn-primary btn-sm ml-2">
              Trải nghiệm trả chai
            </a>
          </nav>
          <button type="button" className="btn btn-quiet -mr-2 md:hidden" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen((o) => !o)}>
            <Icon name={open ? 'x' : 'menu'} size={20} />
            <span className="sr-only">Menu</span>
          </button>
        </div>
        {open && (
          <nav id="site-menu" aria-label="Điều hướng chính" className="sheet-in border-t border-line px-4 pb-4 pt-2 md:hidden">
            {NAV.map((n) => (
              <a key={n.key} href={n.href} onClick={() => setOpen(false)} className="flex min-h-[44px] items-center border-b border-line/70 text-[15px] font-medium text-ink">
                {n.label}
              </a>
            ))}
            <a href="#app-return" onClick={() => setOpen(false)} className="btn btn-primary mt-3 w-full">
              Trải nghiệm trả chai
            </a>
          </nav>
        )}
      </header>
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <footer className="border-t border-line bg-sunk/50">
        <div className="mx-auto grid max-w-content gap-6 px-4 py-10 sm:px-6 md:grid-cols-[1fr_2fr]">
          <div className="flex flex-col gap-3">
            <Wordmark sub="Hệ thống thu hồi chai PET thông minh" />
            <span className="text-xs text-muted">Mô hình đề xuất · PCIC 2026</span>
          </div>
          <p className="max-w-[68ch] text-sm text-muted">
            RE là ý tưởng dự thi của một nhóm sinh viên, chưa có mẫu thử vật lý và chưa vận hành. Trang này là bản mẫu tương tác: sự kiện phần cứng, nhận diện, định tuyến, điểm thưởng
            và hồ sơ đều được mô phỏng trong trình duyệt bằng dữ liệu demo. Không có lời chứng thực, đối tác, giải thưởng hay số liệu vận hành nào được trình bày ở đây.
          </p>
        </div>
      </footer>
    </div>
  );
}
