import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { api } from '../lib/api';
import StatsOverview from './StatsOverview';
import HouseholdManager from './HouseholdManager';
import Toast from './Toast';
import StoreView, { StoreManager } from './StoreView';
import HistoryView from './HistoryView';
import ScheduleView from './ScheduleView';

const NAV_ITEMS = [
  { key: 'schedule', label: '스케줄' },
  { key: 'household', label: '역할 & 가족 관리' },
  { key: 'store', label: '코인 스토어' },
  { key: 'history', label: '히스토리' },
];

function Dashboard({ token, currentUser, onUserUpdate, onLogout }) {
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [activeProfile, setActiveProfile] = useState(null);

  const [queuesData, setQueuesData] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [storeData, setStoreData] = useState({ items: [], purchases: [], averageReward: 65 });
  const [scheduleData, setScheduleData] = useState({ blocks: [], unscheduled: [] });
  const [scheduleDate, setScheduleDate] = useState(dayjs().format('YYYY-MM-DD'));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const [navOpen, setNavOpen] = useState(false);
  const [activeView, setActiveView] = useState('schedule');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [storeLoading, setStoreLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [storeManagerOpen, setStoreManagerOpen] = useState(false);
  const [initialProfileSynced, setInitialProfileSynced] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);

  const showToast = useCallback((message, tone = 'info') => {
    setToast({ message, tone, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadSchedule = useCallback(
    async (profileId, date) => {
      if (!token || !profileId) return;
      const targetDate = date || dayjs().format('YYYY-MM-DD');
      setScheduleLoading(true);
      try {
        const response = await api.schedule.fetch(token, profileId, targetDate);
        setScheduleData({
          blocks: response.blocks || [],
          unscheduled: response.unscheduled || [],
          activeProfile: response.activeProfile,
          date: response.date || targetDate,
        });
        if (response?.profiles) {
          setProfiles(response.profiles);
        }
        if (response?.activeProfile) {
          setActiveProfile(response.activeProfile);
          if (!activeProfileId) {
            setActiveProfileId(response.activeProfile.profileId);
          }
        }
      } catch (err) {
        console.error('Failed to load schedule', err);
        showToast(err.message || '스케줄 정보를 불러오지 못했습니다.', 'error');
      } finally {
        setScheduleLoading(false);
      }
    },
    [showToast, token, activeProfileId]
  );

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
    if (activeProfileId) {
      await loadSchedule(activeProfileId, scheduleDate);
    }
  }, [activeProfileId, loadCoreData, loadSchedule, scheduleDate]);

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
    [showToast, token, activeProfileId]
  );

  const loadStore = useCallback(
    async (profileId) => {
      if (!token || !profileId) return;
      setStoreLoading(true);
      try {
        const response = await api.store.fetch(token, profileId);
        setStoreData(response);
        if (response?.profiles) {
          setProfiles(response.profiles);
        }
        if (response?.activeProfile) {
          setActiveProfile(response.activeProfile);
          if (!activeProfileId) {
            setActiveProfileId(response.activeProfile.profileId);
          }
        }
      } catch (err) {
        console.error('Failed to load store', err);
        showToast(err.message || '스토어 정보를 불러오지 못했습니다.', 'error');
      } finally {
        setStoreLoading(false);
      }
    },
    [showToast, token, activeProfileId]
  );

  useEffect(() => {
    if (activeView === 'store' && activeProfileId) {
      loadStore(activeProfileId);
    }
    if (activeView === 'schedule' && activeProfileId) {
      loadSchedule(activeProfileId, scheduleDate);
    }
    if (activeView === 'history' && activeProfileId) {
      loadHistory(activeProfileId);
    }
  }, [activeProfileId, activeView, loadStore, loadSchedule, loadHistory, scheduleDate]);

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
    const requestPayload = {
      ...payload,
    };
    if (!requestPayload.assignedProfileId) {
      requestPayload.assignedProfileId = activeProfileId;
    }
    try {
      await api.queues.createTask(token, requestPayload, activeProfileId);
      await refreshData();
      showToast('새로운 작업을 큐에 추가했습니다.', 'success');
    } catch (err) {
      console.error('Failed to create task', err);
      showToast(err.message || '작업 추가에 실패했습니다.', 'error');
      throw err;
    }
  };

  const handleCreateStoreItem = async (payload) => {
    if (!activeProfileId) {
      showToast('먼저 계정을 선택해주세요.', 'warning');
      return;
    }
    try {
      await api.store.createItem(token, {
        ...payload,
        profileId: activeProfileId,
      });
      await loadStore(activeProfileId);
      showToast('스토어에 상품을 등록했습니다.', 'success');
    } catch (err) {
      console.error('Failed to create store item', err);
      showToast(err.message || '상품 등록에 실패했습니다.', 'error');
    }
  };

  const handleUpdateTaskDetails = async (taskId, updates) => {
    if (!activeProfileId) {
      showToast('먼저 계정을 선택해주세요.', 'warning');
      return;
    }
    try {
      await api.queues.updateTask(token, taskId, updates, activeProfileId);
      await Promise.all([
        loadSchedule(activeProfileId, scheduleDate),
        loadCoreData(activeProfileId, { withLoading: false }),
      ]);
      showToast('작업 정보를 수정했습니다.', 'info');
    } catch (err) {
      console.error('Failed to update task details', err);
      showToast(err.message || '작업 수정에 실패했습니다.', 'error');
      throw err;
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!activeProfileId) {
      showToast('먼저 계정을 선택해주세요.', 'warning');
      return;
    }
    try {
      await api.queues.deleteTask(token, taskId, activeProfileId);
      await Promise.all([
        loadSchedule(activeProfileId, scheduleDate),
        loadCoreData(activeProfileId, { withLoading: false }),
      ]);
      showToast('작업을 삭제했습니다.', 'warning');
    } catch (err) {
      console.error('Failed to delete task', err);
      showToast(err.message || '작업 삭제에 실패했습니다.', 'error');
      throw err;
    }
  };

  const handleCreateBlock = async ({ start, end, type, title, startMinuteOfDay, endMinuteOfDay }) => {
    if (!activeProfileId) {
      showToast('먼저 계정을 선택해주세요.', 'warning');
      return;
    }
    try {
      await api.schedule.createBlock(token, {
        profileId: activeProfileId,
        start,
        end,
        type,
        title: title && typeof title === 'string' ? title.trim() || undefined : undefined,
        startMinuteOfDay,
        endMinuteOfDay,
      });
      await loadSchedule(activeProfileId, scheduleDate);
      showToast('새로운 시간 블록을 만들었습니다.', 'success');
    } catch (err) {
      console.error('Failed to create schedule block', err);
      showToast(err.message || '블록 생성에 실패했습니다.', 'error');
      throw err;
    }
  };

  const handleDeleteBlock = async (block) => {
    try {
      await api.schedule.deleteBlock(token, block._id);
      await loadSchedule(activeProfileId, scheduleDate);
      showToast('블록을 삭제했습니다.', 'info');
    } catch (err) {
      console.error('Failed to delete schedule block', err);
      showToast(err.message || '블록 삭제에 실패했습니다.', 'error');
    }
  };

  const handleUpdateBlock = async (blockId, updates) => {
    try {
      await api.schedule.updateBlock(token, blockId, updates);
      await loadSchedule(activeProfileId, scheduleDate);
      showToast('블록 정보를 수정했습니다.', 'info');
    } catch (err) {
      console.error('Failed to update schedule block', err);
      showToast(err.message || '블록 수정에 실패했습니다.', 'error');
      throw err;
    }
  };

  const handleAssignTask = async ({ blockId, taskId, start, end, scheduleDate: scheduleDateParam }) => {
    const targetDate = scheduleDateParam || scheduleDate;
    try {
      await api.schedule.assignTask(token, blockId, {
        taskId,
        start,
        end,
        scheduleDate: targetDate,
      });
      await Promise.all([
        loadSchedule(activeProfileId, targetDate),
        loadCoreData(activeProfileId, { withLoading: false }),
      ]);
      showToast('작업을 블록에 배치했습니다.', 'success');
    } catch (err) {
      console.error('Failed to assign task to block', err);
      showToast(err.message || '작업 배치에 실패했습니다.', 'error');
    }
  };

  const handleUnassignTask = async (task) => {
    try {
      await api.schedule.unassignTask(token, task._id);
      await Promise.all([
        loadSchedule(activeProfileId, scheduleDate),
        loadCoreData(activeProfileId, { withLoading: false }),
      ]);
      showToast('작업을 블록에서 제거했습니다.', 'info');
    } catch (err) {
      console.error('Failed to unassign task', err);
      showToast(err.message || '작업 해제에 실패했습니다.', 'error');
    }
  };

  const handleToggleTask = async (task, shouldComplete) => {
    try {
      if (shouldComplete) {
        await api.queues.completeTask(token, task._id, activeProfileId);
      } else {
        await api.queues.reopenTask(token, task._id, activeProfileId);
      }
      await Promise.all([
        loadSchedule(activeProfileId, scheduleDate),
        loadCoreData(activeProfileId, { withLoading: false }),
      ]);
      showToast(shouldComplete ? '작업을 완료했습니다.' : '작업을 다시 진행 상태로 변경했습니다.', shouldComplete ? 'success' : 'info');
    } catch (err) {
      console.error('Failed to toggle task status', err);
      showToast(err.message || '작업 상태 변경에 실패했습니다.', 'error');
    }
  };

  const handlePurchaseStoreItem = async (item) => {
    if (availableCoins < item.price) {
      showToast('코인이 부족합니다. 작업을 완료하고 코인을 모아보세요!', 'warning');
      return;
    }
    try {
      await api.store.purchaseItem(token, item._id);
      await Promise.all([refreshData(), loadStore(activeProfileId)]);
      showToast(`${item.name}을(를) 구매했습니다!`, 'success');
    } catch (err) {
      console.error('Failed to purchase store item', err);
      showToast(err.message || '구매에 실패했습니다.', 'error');
    }
  };

  const handleUpdateStoreItem = async (itemId, updates) => {
    try {
      await api.store.updateItem(token, itemId, updates);
      await loadStore(activeProfileId);
      showToast('상품 정보를 수정했습니다.', 'info');
    } catch (err) {
      console.error('Failed to update store item', err);
      showToast(err.message || '상품 수정에 실패했습니다.', 'error');
      throw err;
    }
  };

  const handleDeleteStoreItem = async (itemId) => {
    try {
      await api.store.deleteItem(token, itemId);
      await loadStore(activeProfileId);
      showToast('상품을 삭제했습니다.', 'warning');
    } catch (err) {
      console.error('Failed to delete store item', err);
      showToast(err.message || '상품 삭제에 실패했습니다.', 'error');
      throw err;
    }
  };

  const activeProfileName = activeProfile?.name || '계정 없음';
  const availableCoins = progressData?.user?.coins || 0;
  const averageReward = storeData?.averageReward || 65;

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

  const renderScheduleView = () => (
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
      <ScheduleView
        date={scheduleDate}
        onDateChange={(newDate) => {
          setScheduleDate(newDate);
          if (activeProfileId) {
            loadSchedule(activeProfileId, newDate);
          }
        }}
        blocks={scheduleData.blocks || []}
        unscheduled={scheduleData.unscheduled || []}
        loading={scheduleLoading}
        activeProfile={activeProfile}
        onCreateTask={handleCreateTask}
        onUpdateTask={handleUpdateTaskDetails}
        onDeleteTask={handleDeleteTask}
        onCreateBlock={handleCreateBlock}
        onDeleteBlock={handleDeleteBlock}
        onUpdateBlock={handleUpdateBlock}
        onAssignTask={handleAssignTask}
        onUnassignTask={handleUnassignTask}
        onToggleTask={handleToggleTask}
        onRefresh={() => loadSchedule(activeProfileId, scheduleDate)}
      />
    </>
  );

  const renderStoreView = () => (
    <StoreView
      items={storeData?.items || []}
      purchases={storeData?.purchases || []}
      activeProfile={storeData?.activeProfile || activeProfile}
      averageReward={averageReward}
      availableCoins={availableCoins}
      onPurchaseItem={handlePurchaseStoreItem}
      onOpenManager={() => setStoreManagerOpen(true)}
      loading={storeLoading}
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
  if (activeView === 'store') {
    currentView = renderStoreView();
  } else if (activeView === 'history') {
    currentView = renderHistoryView();
  } else if (activeView === 'household') {
    currentView = renderHouseholdView();
  } else {
    currentView = renderScheduleView();
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
      <StoreManager
        open={storeManagerOpen}
        onClose={() => setStoreManagerOpen(false)}
        items={storeData?.items || []}
        onCreateItem={handleCreateStoreItem}
        onUpdateItem={handleUpdateStoreItem}
        onDeleteItem={handleDeleteStoreItem}
        averageReward={averageReward}
        loading={storeLoading}
      />
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
