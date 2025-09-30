import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function HistoryView({ data, loading, activeProfileName }) {
  const history = data?.history || [];

  return (
    <section className="history-view">
      <header>
        <h2>클리어 히스토리</h2>
        <p>{activeProfileName}님의 최근 집중 세션 기록</p>
      </header>

      {loading ? (
        <div className="history-loading">
          <div className="spinner" />
          <p>히스토리를 불러오는 중입니다...</p>
        </div>
      ) : history.length === 0 ? (
        <p className="empty">아직 완료 기록이 없습니다. 첫 작업을 완료해보세요!</p>
      ) : (
        <div className="history-chart">
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={history} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="30%" stopColor="#2563eb" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fill: '#475569' }} />
              <YAxis allowDecimals={false} tick={{ fill: '#475569' }} width={32} />
              <Tooltip
                formatter={(value) => [`${value}개 완료`, '작업']}
                labelFormatter={(label) => `${label} 완료`}
              />
              <Area
                type="monotone"
                dataKey="completedCount"
                stroke="#1d4ed8"
                fillOpacity={1}
                fill="url(#colorCompleted)"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export default HistoryView;
