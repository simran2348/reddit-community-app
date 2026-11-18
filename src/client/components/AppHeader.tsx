import { memo } from 'react';

type AppHeaderProps = {
  subredditName: string | undefined;
};

export const AppHeader = memo(({ subredditName }: AppHeaderProps) => (
  <header className="app-header">
    <span className="app-header__mark" aria-hidden="true">
      ★
    </span>
    <div className="app-header__text">
      <h1 className="app-header__title">
        {subredditName ? `r/${subredditName}` : 'Community'} Leaderboard
      </h1>
      <p className="app-header__subtitle">Top images of the week &amp; month</p>
    </div>
  </header>
));
AppHeader.displayName = 'AppHeader';
