import { useMemo, useState } from 'react';

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: '쉬움' },
  { value: 'medium', label: '보통' },
  { value: 'hard', label: '어려움' },
];

function QueueColumn({
  queue,
  activeProfile,
  isActive,
  onActivate,
  onCreateTask,
  onCompleteTask,
  onDeleteTask,
  onReorder,
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    difficulty: 'medium',
  });
  const [submitting, setSubmitting] = useState(false);

  const tasks = queue?.tasks || [];

  const titlePlaceholder = useMemo(() => {
    if (!queue) return '작업 제목';
    return queue.key === 'deep'
      ? '예: 마케팅 전략 문서 초안 작성'
      : '예: 이메일 정리하기';
  }, [queue]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      difficulty: 'medium',
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!queue || !activeProfile) return;

    setSubmitting(true);
    try {
      await onCreateTask({
        queue: queue.key,
        title: form.title.trim(),
        description: form.description.trim(),
        difficulty: form.difficulty,
        assignedProfileId: activeProfile.profileId,
      });
      resetForm();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMove = (taskId, direction) => {
    const index = tasks.findIndex((task) => task._id === taskId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= tasks.length) return;

    const reordered = [...tasks];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);

    onReorder(queue.key, reordered.map((task) => task._id));
  };

  return (
    <section className={`queue-column ${isActive ? 'active' : ''}`}>
      <header className="queue-header" onClick={onActivate} role="presentation">
        <div>
          <h2>{queue?.label || '큐'}</h2>
          <p>{queue?.description}</p>
        </div>
        <span className="queue-count">{tasks.length}개 작업</span>
      </header>

      <form className="task-form" onSubmit={handleSubmit}>
        <input
          type="text"
          name="title"
          placeholder={titlePlaceholder}
          value={form.title}
          onChange={handleChange}
          required
          disabled={submitting || !activeProfile}
        />
        <textarea
          name="description"
          placeholder="간단한 메모 (선택)"
          value={form.description}
          onChange={handleChange}
          rows={2}
          disabled={submitting || !activeProfile}
        />
        <div className="task-form-row single">
          <select
            name="difficulty"
            value={form.difficulty}
            onChange={handleChange}
            disabled={submitting}
          >
            {DIFFICULTY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="task-form-meta">
            <span>
              담당: <strong>{activeProfile?.name || '미지정 계정'}</strong>
            </span>
          </div>
          <button type="submit" disabled={submitting || !activeProfile}>
            {submitting ? '추가 중...' : '추가'}
          </button>
        </div>
      </form>

      <div className="task-list">
        {tasks.length === 0 ? (
          <div className="queue-empty">
            <h3>모든 작업 완료!</h3>
            <p>새로운 작업을 추가하거나 잠깐 쉬어가도 좋아요.</p>
          </div>
        ) : (
          tasks.map((task, index) => (
            <article key={task._id} className="task-card">
              <header>
                <h3>{task.title}</h3>
                <span className={`difficulty ${task.difficulty}`}>
                  {task.difficulty === 'easy'
                    ? '쉬움'
                    : task.difficulty === 'hard'
                    ? '어려움'
                    : '보통'}
                </span>
              </header>
              {task.description ? <p className="task-desc">{task.description}</p> : null}
              <footer>
                <div className="task-meta">
                  <span>담당: {task.assignedProfileName}</span>
                  {task.dueDate ? (
                    <span>
                      마감: {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
                <div className="task-actions">
                  <button type="button" onClick={() => onCompleteTask(task._id)}>
                    완료
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(task._id, 'up')}
                    disabled={index === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(task._id, 'down')}
                    disabled={index === tasks.length - 1}
                  >
                    ↓
                  </button>
                  <button type="button" className="danger" onClick={() => onDeleteTask(task._id)}>
                    삭제
                  </button>
                </div>
              </footer>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export default QueueColumn;
