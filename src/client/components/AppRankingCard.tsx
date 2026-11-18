import { memo, useState } from 'react';
import { navigateTo } from '@devvit/web/client';
import type { AppRanking } from '../../shared/api';
import { formatCount, plural } from '../format';

type AppRankingCardProps = {
  app: AppRanking;
};

const AppIcon = ({ app }: { app: AppRanking }) => {
  const [failed, setFailed] = useState(false);
  if (!app.iconUrl || failed) {
    return (
      <span className="app-card__icon app-card__icon--fallback" aria-hidden="true">
        {app.name.trim().charAt(0).toUpperCase() || '?'}
      </span>
    );
  }
  return (
    <img
      className="app-card__icon"
      src={app.iconUrl}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
};

export const AppRankingCard = memo(({ app }: AppRankingCardProps) => {
  const tier = app.rank <= 3 ? ` app-card--top app-card--rank-${app.rank}` : '';
  return (
    <article className={`card app-card${tier}`}>
      <div className="app-card__head">
        <span className="rank-badge" aria-label={`Rank ${app.rank}`}>
          #{app.rank}
        </span>
        <AppIcon app={app} />
        <div className="app-card__titles">
          <h2 className="app-card__name">{app.name}</h2>
          <p className="app-card__author">u/{app.author}</p>
        </div>
      </div>

      <p className="app-card__description">
        {app.description || 'No description provided.'}
      </p>

      <div className="app-card__footer">
        <div className="app-card__stats">
          <span className="stat stat--accent" title={`${app.score} upvotes`}>
            ▲ {formatCount(app.score)}
          </span>
          <span className="stat">
            {plural(app.commentCount, 'comment', 'comments')}
          </span>
        </div>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => navigateTo(app.postUrl)}
        >
          View post
        </button>
      </div>
    </article>
  );
});
AppRankingCard.displayName = 'AppRankingCard';
