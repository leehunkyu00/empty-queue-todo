import { useMemo, useState } from 'react';
import dayjs from 'dayjs';

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES_IN_DAY = 24 * 60;
const MINUTES_HEIGHT = 1; // 1px per minute

function formatTime(dateString) {
  if (!dateString) return '';
  return dayjs(dateString).format('HH:mm');
}

function ScheduleBlock({ task, dayStart, onUnschedule }) {
  const start = task.scheduledStart ? dayjs(task.scheduledStart) : null;
  const end = task.scheduledEnd ? dayjs(task.scheduledEnd) : null;
  if (!start) return null;
  const minutesFromStart = start.diff(dayStart, 'minute');
  const duration = end ? Math.max(end.diff(start, 'minute'), 15) : 60;
  const top = Math.max(minutesFromStart, 0) * MINUTES_HEIGHT;
  const height = Math.min(duration, MINUTES_IN_DAY - minutesFromStart) * MINUTES_HEIGHT;

  const queueClass = task.queue === 'deep' ? 'block-deep' : 'block-admin';

  return (
    <div
      className={`schedule-block ${queueClass}`}
      style={{ top, height }}
      role="button"
      tabIndex={0}
      onClick={() => onUnschedule(task)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          onUnschedule(task);
        }
      }}
    >
      <span className="schedule-block-time">
        {formatTime(task.scheduledStart)} - {formatTime(task.scheduledEnd)}
      </span>
      <strong>{task.title}</strong>
      <span className="schedule-block-meta">{task.assignedProfileName}</span>
      <span className="schedule-block-queue">{task.queue === 'deep' ? 'Deep Work' : 'Admin'}</span>
      <small className="schedule-block-action">클릭하여 스케줄 해제</small>
    </div>
  );
}

function ScheduleForm({ date, unscheduled, onSubmit, loading }) {
  const [selectedTask, setSelectedTask] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [error, setError] = useState(null);

  const deepTasks = useMemo(() => unscheduled.filter((task) => task.queue === 'deep'), [unscheduled]);
  const adminTasks = useMemo(() => unscheduled.filter((task) => task.queue === 'admin'), [unscheduled]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedTask) {
      setError('스케줄할 작업을 선택해주세요.');
      return;
    }
    if (!startTime || !endTime) {
      setError('시작과 종료 시간을 입력해주세요.');
      return;
    }
    const start = dayjs(`${date}T${startTime}`);
    const end = dayjs(`${date}T${endTime}`);
    if (!start.isValid() || !end.isValid() || !end.isAfter(start)) {
      setError('올바른 시간 범위를 입력해주세요.');
      return;
    }
    try {
      await onSubmit({ taskId: selectedTask, start: start.toISOString(), end: end.toISOString() });
      setError(null);
    } catch (err) {
      setError(err?.message || '스케줄링에 실패했습니다.');
    }
  };

  return (
    <form className="schedule-form" onSubmit={handleSubmit}>
      <h3>블록 만들기</h3>
      <label>
        작업 선택
        <select value={selectedTask} onChange={(event) => setSelectedTask(event.target.value)}>
          <option value="">작업을 선택하세요</option>
          {deepTasks.length > 0 && (
            <optgroup label="Deep Work">
              {deepTasks.map((task) => (
                <option key={task._id} value={task._id}>
                  {task.title}
                </option>
              ))}
            </optgroup>
          )}
          {adminTasks.length > 0 && (
            <optgroup label="Admin">
              {adminTasks.map((task) => (
                <option key={task._id} value={task._id}>
                  {task.title}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <div className="schedule-time-inputs">
        <label>
          시작
          <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
        </label>
        <label>
          종료
          <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        </label>
      </div>
      {error ? <p className="schedule-error">{error}</p> : null}
      <button type="submit" disabled={loading || !unscheduled.length}>
        스케줄에 추가
      </button>
    </form>
  );
}

function NewTaskForm({ onCreateTask, loading }) {
  const [form, setForm] = useState({
    queue: 'deep',
    title: '',
    description: '',
    difficulty: 'medium',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setError('작업 제목을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreateTask({
        title: form.title.trim(),
        description: form.description.trim(),
        queue: form.queue,
        difficulty: form.difficulty,
      });
      setForm({ queue: 'deep', title: '', description: '', difficulty: 'medium' });
      setError(null);
    } catch (err) {
      console.error('Failed to create task', err);
      setError(err.message || '작업 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="schedule-form" onSubmit={handleSubmit}>
      <h3>새 작업 추가</h3>
      <label>
        구분
        <select name="queue" value={form.queue} onChange={handleChange}>
          <option value="deep">Deep Work</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label>
        제목
        <input
          type="text"
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="예: 전략 문서 작성"
          required
          disabled={submitting || loading}
        />
      </label>
      <label>
        메모
        <textarea
          name="description"
          rows={2}
          value={form.description}
          onChange={handleChange}
          placeholder="선택 메모"
          disabled={submitting || loading}
        />
      </label>
      <label>
        난이도
        <select name="difficulty" value={form.difficulty} onChange={handleChange} disabled={submitting || loading}>
          <option value="easy">쉬움</option>
          <option value="medium">보통</option>
          <option value="hard">어려움</option>
        </select>
      </label>
      {error ? <p className="schedule-error">{error}</p> : null}
      <button type="submit" disabled={submitting || loading}>
        {submitting ? '추가 중...' : '작업 추가'}
      </button>
    </form>
  );
}

function ScheduleView({
  date,
  onDateChange,
  scheduled,
  unscheduled,
  loading,
  onScheduleTask,
  onUnscheduleTask,
  onRefresh,
  onCreateTask,
}) {
  const dayStart = useMemo(() => dayjs(date).startOf('day'), [date]);

  return (
    <div className="schedule-container">
      <header className="schedule-header">
        <div className="schedule-date-controls">
          <button type="button" onClick={() => onDateChange(dayjs(date).subtract(1, 'day').format('YYYY-MM-DD'))}>
            ◀
          </button>
          <input
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
          />
          <button type="button" onClick={() => onDateChange(dayjs(date).add(1, 'day').format('YYYY-MM-DD'))}>
            ▶
          </button>
          <button type="button" onClick={() => onDateChange(dayjs().format('YYYY-MM-DD'))}>
            오늘
          </button>
        </div>
        <div className="schedule-header-actions">
          <button type="button" onClick={onRefresh} className={loading ? 'refresh refreshing' : 'refresh'}>
            {loading ? '새로고침 중...' : '새로고침'}
          </button>
        </div>
      </header>

      <div className="schedule-board">
        <div className="schedule-hours">
          {HOURS.map((hour) => (
            <div key={hour} className="schedule-hour-row">
              <span>{`${String(hour).padStart(2, '0')}:00`}</span>
            </div>
          ))}
        </div>
        <div className="schedule-canvas">
          <div className="schedule-lines">
            {HOURS.map((hour) => (
              <div key={hour} className="schedule-line" style={{ top: hour * 60 * MINUTES_HEIGHT }} />
            ))}
          </div>
          <div className="schedule-blocks">
            {scheduled.map((task) => (
              <ScheduleBlock key={task._id} task={task} dayStart={dayStart} onUnschedule={onUnscheduleTask} />
            ))}
          </div>
        </div>
        <div className="schedule-sidebar">
          <ScheduleForm
            date={date}
            unscheduled={unscheduled}
            loading={loading}
            onSubmit={({ taskId, start, end }) => onScheduleTask(taskId, start, end)}
          />
          <NewTaskForm onCreateTask={onCreateTask} loading={loading} />
          <section className="schedule-unscheduled">
            <h3>미배정 작업 ({unscheduled.length})</h3>
            {unscheduled.length === 0 ? (
              <p className="schedule-empty">모든 작업이 스케줄 되었습니다!</p>
            ) : (
              <ul>
                {unscheduled.map((task) => (
                  <li key={task._id}>
                    <strong>{task.title}</strong>
                    <span>{task.queue === 'deep' ? 'Deep Work' : 'Admin'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default ScheduleView;
