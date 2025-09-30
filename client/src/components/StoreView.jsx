import { useMemo, useState } from 'react';

function computeTaskEquivalent(price, averageReward = 65) {
  if (!price || price <= 0) return '0개';
  const raw = price / averageReward;
  if (raw < 1) {
    return raw.toFixed(1).replace(/\.0$/, '') + '개';
  }
  return Math.max(1, Math.round(raw)) + '개';
}

function StoreItemCard({ item, averageReward, availableCoins, onPurchase, disabled }) {
  const taskEquivalent = useMemo(
    () => computeTaskEquivalent(item.price, averageReward),
    [item.price, averageReward]
  );
  const insufficient = (availableCoins ?? 0) < item.price;

  return (
    <li className="store-item-card">
      <div>
        <strong>{item.name}</strong>
        <p>{item.description || '설명이 없습니다.'}</p>
      </div>
      <div className="store-item-meta">
        <span className="store-price">{item.price} 코인</span>
        <small>≈ {taskEquivalent} 작업</small>
        {insufficient ? <small className="store-warning">코인이 부족합니다</small> : null}
        <button type="button" onClick={() => onPurchase(item)} disabled={disabled}>
          구매하기
        </button>
      </div>
    </li>
  );
}

function EditableStoreItem({ item, onUpdate, onDelete, averageReward, processing }) {
  const [form, setForm] = useState({
    name: item.name,
    description: item.description || '',
    price: item.price,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const taskEquivalent = useMemo(
    () => computeTaskEquivalent(form.price, averageReward),
    [form.price, averageReward]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) {
      setError('상품명과 가격을 입력해주세요.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onUpdate(item._id, {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
      });
    } catch (err) {
      console.error('Failed to update store item', err);
      setError(err.message || '상품 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="store-manager-item">
      <div className="store-manager-fields">
        <label>
          상품명
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            disabled={saving || processing}
          />
        </label>
        <label>
          설명
          <textarea
            name="description"
            rows={2}
            value={form.description}
            onChange={handleChange}
            disabled={saving || processing}
          />
        </label>
        <label>
          가격 (코인)
          <input
            type="number"
            name="price"
            min={1}
            value={form.price}
            onChange={handleChange}
            disabled={saving || processing}
          />
        </label>
        <small className="store-helper">≈ {taskEquivalent} 작업</small>
        {error ? <p className="store-error">{error}</p> : null}
      </div>
      <div className="store-manager-actions">
        <button type="button" onClick={handleSave} disabled={saving || processing}>
          {saving ? '저장 중...' : '저장'}
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => onDelete(item._id)}
          disabled={saving || processing}
        >
          삭제
        </button>
      </div>
    </li>
  );
}

export function StoreManager({
  open,
  onClose,
  items,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  averageReward,
  loading,
}) {
  const [form, setForm] = useState({ name: '', description: '', price: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.price) {
      setError('상품명과 가격을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreateItem({
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
      });
      setForm({ name: '', description: '', price: '' });
    } catch (err) {
      console.error('Failed to create store item', err);
      setError(err.message || '상품 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="store-manager-overlay" role="dialog" aria-modal="true">
      <div className="store-manager">
        <header>
          <h3>상품 등록 / 편집</h3>
          <button type="button" onClick={onClose} className="close-button">
            닫기
          </button>
        </header>
        <form className="store-form" onSubmit={handleSubmit}>
          <label>
            상품명
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="예: 과자 꾸러미"
              required
              disabled={submitting || loading}
            />
          </label>
          <label>
            설명
            <textarea
              name="description"
              rows={3}
              value={form.description}
              onChange={handleChange}
              placeholder="예: 오늘 집중력을 위한 간식"
              disabled={submitting || loading}
            />
          </label>
          <label>
            가격 (코인)
            <input
              type="number"
              name="price"
              min={1}
              value={form.price}
              onChange={handleChange}
              required
              disabled={submitting || loading}
            />
          </label>
          {error ? <p className="store-error">{error}</p> : null}
          <button type="submit" disabled={submitting || loading}>
            {submitting ? '등록 중...' : '상품 등록'}
          </button>
        </form>

        <section>
          <h4>등록된 상품</h4>
          {items.length === 0 ? (
            <p className="store-empty">등록된 상품이 없습니다.</p>
          ) : (
            <ul className="store-manager-list">
              {items.map((item) => (
                <EditableStoreItem
                  key={item._id}
                  item={item}
                  onUpdate={onUpdateItem}
                  onDelete={onDeleteItem}
                  averageReward={averageReward}
                  processing={loading}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StoreView({
  items,
  purchases,
  activeProfile,
  averageReward,
  availableCoins,
  onPurchaseItem,
  onOpenManager,
  loading,
}) {
  return (
    <section className="store-view">
      <header>
        <div>
          <h2>{activeProfile?.name || '계정'}의 코인 스토어</h2>
          <p>스토어에서 상품을 등록하고 클릭 한 번으로 코인을 사용할 수 있어요.</p>
          <div className="store-balance" aria-live="polite">
            보유 코인: <strong>{availableCoins ?? 0}</strong>
          </div>
        </div>
        <button type="button" className="store-manage-button" onClick={onOpenManager}>
          상품 등록 / 편집
        </button>
      </header>

      <div className="store-layout">
        <div className="store-column">
          <h3>스토어 상품</h3>
          {items.length === 0 ? (
            <p className="store-empty">등록된 상품이 없습니다. 상품 등록에서 추가하세요.</p>
          ) : (
            <ul className="store-item-list">
              {items.map((item) => (
                <StoreItemCard
                  key={item._id}
                  item={item}
                  averageReward={averageReward}
                  availableCoins={availableCoins}
                  onPurchase={onPurchaseItem}
                  disabled={loading}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="store-column">
          <h3>구매 내역</h3>
          {purchases.length === 0 ? (
            <p className="store-empty">아직 구매 내역이 없습니다.</p>
          ) : (
            <ul className="store-purchase-list">
              {purchases.map((purchase) => (
                <li key={purchase._id}>
                  <div>
                    <strong>{purchase.storeItemName || purchase.memo || '구매'}</strong>
                    <span>{purchase.amount} 코인</span>
                  </div>
                  <time dateTime={purchase.createdAt}>
                    {new Date(purchase.createdAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export default StoreView;
