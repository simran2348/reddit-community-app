import { memo } from 'react';
import type { AppRanking } from '../../shared/api';
import { AppRankingCard } from './AppRankingCard';
import { Carousel } from './Carousel';

type AppRankingCarouselProps = {
  apps: readonly AppRanking[];
  info: string;
};

const getKey = (app: AppRanking) => app.id;
const renderApp = (app: AppRanking) => <AppRankingCard app={app} />;

export const AppRankingCarousel = memo(
  ({ apps, info }: AppRankingCarouselProps) => (
    <Carousel
      items={apps}
      getKey={getKey}
      renderItem={renderApp}
      variant="peek"
      label="app"
      footer={<p className="ranking-info">ⓘ {info}</p>}
    />
  )
);
AppRankingCarousel.displayName = 'AppRankingCarousel';
