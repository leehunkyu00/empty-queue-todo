import { useState } from 'react';

function CoinUsage({ data, availableCoins, activeProfileName, loading, onSpend }) {
  const [form, setForm] = useState({ amount: '', memo: '' });
  const [submitting, setSubmitting] = useState(false);

  const transactions = data?.transactions || [];
  const totalSpent = data?.summary?.totalSpent || 0;
  const balance = data?.summary?.balance ?? availableCoins ?? 0;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.amount) return;
    setSubmitting(true);
    try {
      await onSpend({
        amount: Number(form.amount),
        memo: form.memo.trim(),
      });
      setForm({ amount: '', memo: '' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="coin-usage">
      <header>
        <h2>코인 사용처</h2>
        <p>
          {activeProfileName}님의 가용 코인 · {balance} / 총 사용 {totalSpent}
        </p>
      </header>

      <form className="coin-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="coinAmount">사용 코인</label>
          <input
            id="coinAmount"
            type="number"
            name="amount"
            min={1}
            value={form.amount}
            onChange={handleChange}
            placeholder="예: 20"
            required
            disabled={submitting}
          />
        </div>
        <div className="form-group">
          <label htmlFor="coinMemo">사용처 메모</label>
          <input
            id="coinMemo"
            type="text"
            name="memo"
            value={form.memo}
            onChange={handleChange}
            placeholder="예: 주말 보너스 간식"
            disabled={submitting}
          />
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? '기록 중...' : '사용 기록 추가'}
        </button>
      </form>

      <div className="coin-ledger">
        <h3>사용 내역</h3>
        {loading ? (
          <div className="ledger-loading">
            <div className="spinner" />
            <p>코인 사용 내역을 불러오는 중...</p>
          </div>
        ) : transactions.length === 0 ? (
          <p className="empty">아직 등록된 코인 사용 내역이 없어요.</p>
        ) : (
          <ul>
            {transactions.map((entry) => (
              <li key={entry._id}>
                <div>
                  <strong>-{entry.amount}</strong>
                  <span>{entry.memo || '메모 없음'}</span>
                </div>
                <time dateTime={entry.createdAt}>
                  {new Date(entry.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default CoinUsage;
