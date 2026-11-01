import { useState } from 'react';

import { Loaded, ScopePicker, StatsBoard, useStats, type MatchScope } from '@/features';
import { Screen } from '@/ui';

export default function StatsScreen() {
  const [scope, setScope] = useState<MatchScope>({ kind: 'all' });
  const stats = useStats(scope);

  return (
    <Screen title="Stats" subtitle="Records and leaderboards from every finished match.">
      <ScopePicker value={scope} onChange={setScope} allLabel="Overall (every match)" />
      <Loaded value={stats} loadingLabel="Crunching the numbers…">
        {(view) => <StatsBoard stats={view} />}
      </Loaded>
    </Screen>
  );
}
