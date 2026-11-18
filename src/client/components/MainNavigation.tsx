import { memo } from 'react';

export type Section = 'images' | 'competition';

type MainNavigationProps = {
  active: Section;
  onChange: (section: Section) => void;
};

const SECTIONS: readonly { id: Section; icon: string; label: string }[] = [
  { id: 'images', icon: '🏆', label: 'Top Images' },
  { id: 'competition', icon: '📸', label: 'Photo Competition' },
];

export const MainNavigation = memo(
  ({ active, onChange }: MainNavigationProps) => (
    <nav className="main-nav" role="tablist" aria-label="Sections">
      {SECTIONS.map((section) => (
        <button
          key={section.id}
          type="button"
          role="tab"
          id={`tab-${section.id}`}
          aria-controls={`panel-${section.id}`}
          aria-selected={active === section.id}
          className={`main-nav__tab${active === section.id ? ' is-active' : ''}`}
          onClick={() => onChange(section.id)}
        >
          <span aria-hidden="true">{section.icon}</span>
          <span className="main-nav__label">{section.label}</span>
        </button>
      ))}
    </nav>
  )
);
MainNavigation.displayName = 'MainNavigation';
