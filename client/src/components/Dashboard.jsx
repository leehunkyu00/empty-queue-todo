import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import QueueColumn from './QueueColumn';
import StatsOverview from './StatsOverview';
import HouseholdManager from './HouseholdManager';
import RecentCompleted from './RecentCompleted';
import FocusBanner from './FocusBanner';
import Toast from './Toast';
import CoinUsage from './CoinUsage';
import HistoryView from './HistoryView';

const NAV_ITEMS = [
  { key: 'main', label: '메인' },
  { key: 'household', label: '역할 & 가족 관리' },
  { key: 'coins', label: '코인 사용처' },
  { key: 'history', label: '히스토리' },
];

function Dashboard({ token, currentUser, onUserUpdate, onLogout }) {
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [activeProfile, setActiveProfile] = useState(null);

  const [queuesData, setQueuesData] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [coinData, setCoinData] = useState({ transactions: [], summary: null });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const [navOpen, setNavOpen] = useState(false);
  const [activeView, setActiveView] = useState('main');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [coinsLoading, setCoinsLoading] = useState(false);
  const [initialProfileSynced, setInitialProfileSynced] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);

  const deepQueue = queuesData?.queues?.deep;
  const adminQueue = queuesData?.queues?.admin;
  const recentCompleted = queuesData?.recentCompleted || [];

  const showToast = useCallback((message, tone = 'info') => {
    setToast({ message, tone, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadCoreData = useCallback(
    async (profileId, { withLoading = true } = {}) => {
      if (!token) return;
      if (withLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const paramsProfileId = profileId || undefined;
        const [queuesResponse, progressResponse] = await Promise.all([
          api.queues.fetch(token, paramsProfileId),
          api.progress.dashboard(token, paramsProfileId),
        ]);

        setQueuesData(queuesResponse);
        setProgressData(progressResponse);

        const inferredProfileId =
          paramsProfileId ||
          queuesResponse?.activeProfile?.profileId ||
          progressResponse?.activeProfile?.profileId ||
          null;

        if (!initialProfileSynced && inferredProfileId) {
          setActiveProfileId(inferredProfileId);
          setInitialProfileSynced(true);
        }

        const latestProfiles =
          queuesResponse?.profiles || progressResponse?.householdMembers || [];
        setProfiles(latestProfiles);

        const activeProfilePayload =
          queuesResponse?.activeProfile ||
          progressResponse?.activeProfile ||
          latestProfiles.find((item) => item.profileId === inferredProfileId) ||
          null;
        setActiveProfile(activeProfilePayload);

        if (progressResponse?.user) {
          onUserUpdate(progressResponse.user);
        }
      } catch (err) {
        console.error('Failed to load dashboard', err);
        setError(err.message || '데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [initialProfileSynced, onUserUpdate, token]
  );

  useEffect(() => {
    loadCoreData(activeProfileId, { withLoading: !initialProfileSynced });
  }, [activeProfileId, initialProfileSynced, loadCoreData]);

  const refreshData = useCallback(async () => {
    await loadCoreData(activeProfileId, { withLoading: false });
  }, [activeProfileId, loadCoreData]);

  const loadHistory = useCallback(
    async (profileId) => {
      if (!token || !profileId) return;
      setHistoryLoading(true);
      try {
        const response = await api.progress.history(token, profileId);
        setHistoryData(response);
      } catch (err) {
        console.error('Failed to load history', err);
        showToast(err.message || '히스토리를 불러오지 못했습니다.', 'error');
      } finally {
        setHistoryLoading(false);
      }
    },
    [showToast, token]
  );

  const loadCoins = useCallback(
    async (profileId) => {
      if (!token || !profileId) return;
      setCoinsLoading(true);
      try {
        const response = await api.coins.list(token, profileId);
        setCoinData(response);
      } catch (err) {
        console.error('Failed to load coin usage', err);
        showToast(err.message || '코인 사용처를 불러오지 못했습니다.', 'error');
      } finally {
        setCoinsLoading(false);
      }
    },
    [showToast, token]
  );

  useEffect(() => {
    if (activeView === 'coins' && activeProfileId) {
      loadCoins(activeProfileId);
    }
    if (activeView === 'history' && activeProfileId) {
      loadHistory(activeProfileId);
    }
  }, [activeProfileId, activeView, loadCoins, loadHistory]);

  const handleViewChange = (viewKey) => {
    setActiveView(viewKey);
    setNavOpen(false);
  };

  const handleProfileChange = (event) => {
    const nextProfileId = event.target.value;
    setActiveProfileId(nextProfileId);
    setActiveProfile(
      profiles.find((profile) => profile.profileId === nextProfileId) || null
    );
  };

  const handleCreateTask = async (payload) => {
    if (!activeProfileId) {
      showToast('먼저 계정을 선택해주세요.', 'warning');
      return;
    }
    try {
      await api.queues.createTask(token, payload, activeProfileId);
      await refreshData();
      showToast('새로운 작업을 큐에 추가했습니다.', 'success');
    } catch (err) {
      console.error('Failed to create task', err);
      showToast(err.message || '작업 추가에 실패했습니다.', 'error');
    }
  };

  const handleCompleteTask = async (taskId) => {
    if (!activeProfileId) return;
    try {
      const response = await api.queues.completeTask(token, taskId, activeProfileId);
      await refreshData();
      if (response?.profile) {
        onUserUpdate(response.profile);
      }

      if (response?.gamification) {
        const { xpGain, coinsGain, levelUp, unlockedBadges } = response.gamification;
        let msg = `🎉 작업 완료! XP ${xpGain} / 코인 ${coinsGain} 획득`;
        if (levelUp) msg += ' · 레벨 업!';
        if (unlockedBadges && unlockedBadges.length > 0) {
          msg += ` · 배지 ${unlockedBadges.join(', ')}`;
        }
        showToast(msg, 'success');
      } else {
        showToast('작업을 완료했습니다.', 'success');
      }
    } catch (err) {
      console.error('Failed to complete task', err);
      showToast(err.message || '작업 완료 처리에 실패했습니다.', 'error');
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    if (!activeProfileId) return;
    try {
      await api.queues.updateTask(token, taskId, updates, activeProfileId);
      await refreshData();
      showToast('작업을 수정했습니다.', 'info');
    } catch (err) {
      console.error('Failed to update task', err);
      showToast(err.message || '작업 수정에 실패했습니다.', 'error');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!activeProfileId) return;
    try {
      await api.queues.deleteTask(token, taskId, activeProfileId);
      await refreshData();
      showToast('작업을 삭제했습니다.', 'info');
    } catch (err) {
      console.error('Failed to delete task', err);
      showToast(err.message || '작업 삭제에 실패했습니다.', 'error');
    }
  };

  const handleReopenTask = async (taskId) => {
    if (!activeProfileId) return;
    try {
      const response = await api.queues.reopenTask(token, taskId, activeProfileId);
      await refreshData();
      if (response?.profile) {
        onUserUpdate(response.profile);
      }
      showToast('작업을 다시 진행 목록으로 이동했습니다.', 'info');
    } catch (err) {
      console.error('Failed to reopen task', err);
      showToast(err.message || '작업 되돌리기에 실패했습니다.', 'error');
    }
  };

  const handleReorderTasks = async (queueKey, orderedIds) => {
    if (!activeProfileId) return;
    try {
      const response = await api.queues.reorder(
        token,
        {
          queue: queueKey,
          orderedTaskIds: orderedIds,
        },
        activeProfileId
      );
      setQueuesData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          queues: {
            ...prev.queues,
            [queueKey]: response.queue,
          },
        };
      });
    } catch (err) {
      console.error('Failed to reorder', err);
      showToast(err.message || '작업 순서를 변경하지 못했습니다.', 'error');
    }
  };

  const handleAddMember = async (payload) => {
    try {
      const response = await api.household.create(token, payload);
      setProfiles(response.members);
      showToast(`${payload.name} 님을 팀에 추가했습니다.`, 'success');
    } catch (err) {
      console.error('Failed to add member', err);
      showToast(err.message || '구성원 추가에 실패했습니다.', 'error');
    }
  };

  const handleUpdateMember = async (profileId, payload) => {
    try {
      const response = await api.household.update(token, profileId, payload);
      setProfiles(response.members);
      showToast('구성원 정보를 업데이트했습니다.', 'info');
    } catch (err) {
      console.error('Failed to update member', err);
      showToast(err.message || '구성원 수정에 실패했습니다.', 'error');
    }
  };

  const handleRemoveMember = async (profileId) => {
    try {
      const response = await api.household.remove(token, profileId);
      setProfiles(response.members);
      if (profileId === activeProfileId) {
        const fallback = response.members[0]?.profileId || null;
        setActiveProfileId(fallback);
        setActiveProfile(
          response.members.find((profile) => profile.profileId === fallback) || null
        );
      }
      showToast('구성원을 삭제했습니다.', 'warning');
    } catch (err) {
      console.error('Failed to remove member', err);
      showToast(err.message || '구성원 삭제에 실패했습니다.', 'error');
    }
  };

  const handleCoinSpend = async ({ amount, memo }) => {
    if (!activeProfileId) {
      showToast('먼저 계정을 선택해주세요.', 'warning');
      return;
    }
    try {
      await api.coins.spend(token, {
        amount,
        memo,
        profileId: activeProfileId,
      });
      await Promise.all([refreshData(), loadCoins(activeProfileId)]);
      showToast('코인 사용 내역을 기록했습니다.', 'success');
    } catch (err) {
      console.error('Failed to record coin usage', err);
      showToast(err.message || '코인 사용 기록에 실패했습니다.', 'error');
    }
  };

  const activeProfileName = activeProfile?.name || '계정 없음';
  const availableCoins = progressData?.user?.coins || 0;

  const levelValue =
    progressData?.levelProgress?.level ?? progressData?.user?.level ?? 0;
  const coinsValue = progressData?.user?.coins ?? 0;
  const streakValue =
    progressData?.streak?.current ?? progressData?.user?.streakCount ?? 0;
  const deepPending = progressData?.queueStats?.deep?.pending ?? 0;
  const adminPending = progressData?.queueStats?.admin?.pending ?? 0;

  const statsSummaryItems = [
    `Lv. ${levelValue}`,
    `코인 ${coinsValue}`,
    `연속 ${streakValue}일`,
    `진행 Deep ${deepPending} · Admin ${adminPending}`,
  ];

  const renderMainView = () => (
    <>
      <section className={`stats-panel ${statsExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="stats-toggle-bar">
          <div className="stats-summary" role="status" aria-live="polite">
            {statsSummaryItems.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <button
            type="button"
            className="stats-toggle-button"
            onClick={() => setStatsExpanded((prev) => !prev)}
            aria-expanded={statsExpanded}
            aria-controls="stats-panel-content"
          >
            {statsExpanded ? '접기 ▲' : '펼치기 ▼'}
          </button>
        </div>
        {statsExpanded && (
          <div id="stats-panel-content" className="stats-panel-body">
            <StatsOverview data={progressData} />
          </div>
        )}
      </section>
      <FocusBanner deepQueue={deepQueue} adminQueue={adminQueue} />
      <div className="queues-container">
        <QueueColumn
          queue={deepQueue}
          activeProfile={activeProfile}
          isActive
          onActivate={() => {}}
          onCreateTask={handleCreateTask}
          onCompleteTask={handleCompleteTask}
          onDeleteTask={handleDeleteTask}
          onUpdateTask={handleUpdateTask}
          onReorder={handleReorderTasks}
        />
        <QueueColumn
          queue={adminQueue}
          activeProfile={activeProfile}
          isActive={false}
          onActivate={() => {}}
          onCreateTask={handleCreateTask}
          onCompleteTask={handleCompleteTask}
          onDeleteTask={handleDeleteTask}
          onUpdateTask={handleUpdateTask}
          onReorder={handleReorderTasks}
        />
      </div>
      <div className="bottom-grid">
        <RecentCompleted items={recentCompleted} onReopen={handleReopenTask} />
      </div>
    </>
  );

  const renderCoinView = () => (
    <CoinUsage
      data={coinData}
      availableCoins={availableCoins}
      activeProfileName={activeProfileName}
      loading={coinsLoading}
      onSpend={handleCoinSpend}
    />
  );

  const renderHistoryView = () => (
    <HistoryView
      data={historyData}
      loading={historyLoading}
      activeProfileName={activeProfileName}
    />
  );

  const renderHouseholdView = () => (
    <HouseholdManager
      members={profiles}
      activeProfileId={activeProfileId}
      onAddMember={handleAddMember}
      onUpdateMember={handleUpdateMember}
      onRemoveMember={handleRemoveMember}
    />
  );

  let currentView;
  if (activeView === 'coins') {
    currentView = renderCoinView();
  } else if (activeView === 'history') {
    currentView = renderHistoryView();
  } else if (activeView === 'household') {
    currentView = renderHouseholdView();
  } else {
    currentView = renderMainView();
  }

  if (loading && !initialProfileSynced) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" />
        <p>큐 데이터를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <p>{error}</p>
        <button type="button" onClick={() => loadCoreData(activeProfileId)}>
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`nav-panel ${navOpen ? 'open' : ''}`}>
        <div className="nav-header">
          <h2>Empty Queue</h2>
          <button type="button" className="nav-close" onClick={() => setNavOpen(false)}>
            ×
          </button>
        </div>
        <nav>
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.key} className={item.key === activeView ? 'active' : ''}>
                <button type="button" onClick={() => handleViewChange(item.key)}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {navOpen ? <div className="nav-overlay" onClick={() => setNavOpen(false)} /> : null}

      <div className="dashboard">
        <header className="dashboard-header">
          <div className="header-left">
            <button type="button" className="hamburger" onClick={() => setNavOpen(true)}>
              <span />
              <span />
              <span />
            </button>
            <div>
              <h1>Empty Queue HQ</h1>
              <p>
                {activeProfileName}님의 집중 큐 — 오늘도 비워봅시다!
              </p>
            </div>
          </div>
          <div className="header-actions">
            <div className="profile-switcher">
              <label htmlFor="profileSelect">계정</label>
              <select
                id="profileSelect"
                value={activeProfileId || ''}
                onChange={handleProfileChange}
              >
                {profiles.map((profile) => (
                  <option key={profile.profileId} value={profile.profileId}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => refreshData()}
              className={refreshing ? 'refresh refreshing' : 'refresh'}
            >
              {refreshing ? '새로고침 중...' : '새로고침'}
            </button>
            <button type="button" className="logout" onClick={onLogout}>
              로그아웃
            </button>
          </div>
        </header>

        <section className="view-container">{currentView}</section>

        {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
      </div>
    </div>
  );
}

export default Dashboard;
