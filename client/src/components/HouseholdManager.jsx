import { useState } from 'react';

const COLOR_OPTIONS = ['#2563eb', '#f97316', '#10b981', '#a855f7', '#f43f5e'];

function HouseholdManager({ members, activeProfileId, onAddMember, onUpdateMember, onRemoveMember }) {
  const handleFocusChange = async (profileId, preference) => {
    try {
      await onUpdateMember(profileId, { focusModePreference: preference });
    } catch (err) {
      console.error('Failed to update member focus', err);
    }
  };

  const handleRemove = async (profileId) => {
    try {
      await onRemoveMember(profileId);
    } catch (err) {
      console.error('Failed to remove member', err);
    }
  };

  const [form, setForm] = useState({
    name: '',
    avatarColor: COLOR_OPTIONS[1],
    focusModePreference: 'deep',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      await onAddMember({
        name: form.name.trim(),
        avatarColor: form.avatarColor,
        focusModePreference: form.focusModePreference,
      });
      setForm({ name: '', avatarColor: COLOR_OPTIONS[1], focusModePreference: 'deep' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="household-manager">
      <h2>역할 & 가족 관리</h2>
      <p className="helper-text">멤버별로 작업을 배정하고 포커스 모드를 설정하세요.</p>

      <ul className="member-list">
        {members.map((member) => (
          <li key={member.profileId} className={member.profileId === activeProfileId ? 'active' : ''}>
            <div className="member-info">
              <span
                className="avatar"
                style={{ backgroundColor: member.avatarColor }}
                aria-hidden
              />
              <div>
                <strong>{member.name}</strong>
                <span>{member.role === 'primary' ? '관리자' : '구성원'}</span>
              </div>
              {member.profileId === activeProfileId ? <span className="active-tag">사용 중</span> : null}
            </div>
            <div className="member-actions">
              <select
                value={member.focusModePreference || 'deep'}
                onChange={(event) =>
                  handleFocusChange(member.profileId, event.target.value)
                }
              >
                <option value="deep">Deep Work 선호</option>
                <option value="admin">Admin 선호</option>
              </select>
              {member.role !== 'primary' ? (
                <button
                  type="button"
                  className="danger"
                  onClick={() => handleRemove(member.profileId)}
                >
                  제거
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <form className="member-form" onSubmit={handleSubmit}>
        <input
          type="text"
          name="name"
          placeholder="새 구성원 이름"
          value={form.name}
          onChange={handleChange}
          required
          disabled={submitting}
        />
        <div className="color-options">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              type="button"
              className={form.avatarColor === color ? 'color active' : 'color'}
              style={{ backgroundColor: color }}
              onClick={() => setForm((prev) => ({ ...prev, avatarColor: color }))}
              disabled={submitting}
            />
          ))}
        </div>
        <select
          name="focusModePreference"
          value={form.focusModePreference}
          onChange={handleChange}
          disabled={submitting}
        >
          <option value="deep">Deep Work 중심</option>
          <option value="admin">Admin 중심</option>
        </select>
        <button type="submit" disabled={submitting}>
          {submitting ? '추가 중...' : '구성원 추가'}
        </button>
      </form>
    </section>
  );
}

export default HouseholdManager;
