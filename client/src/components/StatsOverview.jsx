function ProgressBar({ progress }) {
  const percentage = Math.min(100, Math.round((progress || 0) * 100));
  return (
    <div className="progress-bar">
      <div className="progress-bar-fill" style={{ width: `${percentage}%` }} />
    </div>
  );
}

function StatsOverview({ data }) {
  if (!data) return null;

  const { user, levelProgress, queueStats, streak, badges = [] } = data;

  return (
    <section className="stats-overview">
      <div className="stat-card level">
        <div className="stat-header">
          <h3>현재 레벨</h3>
          <span className="stat-value">Lv. {levelProgress?.level || user?.level}</span>
        </div>
        <p>누적 XP: {levelProgress?.xp ?? user?.xp ?? 0}</p>
        <ProgressBar progress={levelProgress?.progress || 0} />
        <small>
          다음 레벨까지 {Math.max(0, (levelProgress?.nextLevelXp || 0) - (levelProgress?.xp || 0))} XP 남음
        </small>
      </div>

      <div className="stat-card coins">
        <div className="stat-header">
          <h3>코인</h3>
          <span className="stat-value">{user?.coins ?? 0}</span>
        </div>
        <p>작업 완료로 모은 보상 코인</p>
      </div>

      <div className="stat-card streak">
        <div className="stat-header">
          <h3>연속 집중일</h3>
          <span className="stat-value">{streak?.current ?? user?.streakCount ?? 0}일</span>
        </div>
        <p>최장 기록 {streak?.longest ?? user?.longestStreak ?? 0}일</p>
      </div>

      <div className="stat-card queues">
        <div className="queue-stats">
          <div>
            <h4>Deep Work</h4>
            <p>
              진행 중 {queueStats?.deep?.pending ?? 0}개 · 완료 {queueStats?.deep?.completed ?? 0}개
            </p>
          </div>
          <div>
            <h4>Admin</h4>
            <p>
              진행 중 {queueStats?.admin?.pending ?? 0}개 · 완료 {queueStats?.admin?.completed ?? 0}개
            </p>
          </div>
        </div>
        <div className="badges">
          {badges.length === 0 ? (
            <span className="badge placeholder">첫 배지를 노려보세요!</span>
          ) : (
            badges.map((badge) => (
              <span key={badge} className="badge">
                {badge}
              </span>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default StatsOverview;
