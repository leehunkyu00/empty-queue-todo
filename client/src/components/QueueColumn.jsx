import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: '쉬움' },
  { value: 'medium', label: '보통' },
  { value: 'hard', label: '어려움' },
];

function SortableTaskCard({
  task,
  index,
  isLast,
  onCompleteTask,
  onMove,
  onDeleteTask,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task._id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <article ref={setNodeRef} style={style} className={`task-card ${isDragging ? 'dragging' : ''}`}>
      <header>
        <h3>{task.title}</h3>
        <div className="task-header-actions">
          <button type="button" className="drag-handle" aria-label="작업 순서 변경" {...attributes} {...listeners}>
            <span />
            <span />
            <span />
          </button>
          <span className={`difficulty ${task.difficulty}`}>
            {task.difficulty === 'easy'
              ? '쉬움'
              : task.difficulty === 'hard'
              ? '어려움'
              : '보통'}
          </span>
        </div>
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
            onClick={() => onMove(task._id, 'up')}
            disabled={index === 0}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(task._id, 'down')}
            disabled={isLast}
          >
            ↓
          </button>
          <button type="button" className="danger" onClick={() => onDeleteTask(task._id)}>
            삭제
          </button>
        </div>
      </footer>
    </article>
  );
}

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
  const [internalTasks, setInternalTasks] = useState(queue?.tasks || []);

  useEffect(() => {
    setInternalTasks(queue?.tasks || []);
  }, [queue?.tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

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
    const index = internalTasks.findIndex((task) => task._id === taskId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= internalTasks.length) return;

    const reordered = arrayMove(internalTasks, index, newIndex);
    setInternalTasks(reordered);
    onReorder(queue.key, reordered.map((task) => task._id));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = internalTasks.findIndex((task) => task._id === active.id);
    const newIndex = internalTasks.findIndex((task) => task._id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(internalTasks, oldIndex, newIndex);
    setInternalTasks(reordered);
    onReorder(queue.key, reordered.map((task) => task._id));
  };

  const taskIds = internalTasks.map((task) => task._id);

  return (
    <section className={`queue-column ${isActive ? 'active' : ''}`}>
      <header className="queue-header" onClick={onActivate} role="presentation">
        <div>
          <h2>{queue?.label || '큐'}</h2>
          <p>{queue?.description}</p>
        </div>
        <span className="queue-count">{internalTasks.length}개 작업</span>
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="task-list">
            {internalTasks.length === 0 ? (
              <div className="queue-empty">
                <h3>모든 작업 완료!</h3>
                <p>새로운 작업을 추가하거나 잠깐 쉬어가도 좋아요.</p>
              </div>
            ) : (
              internalTasks.map((task, index) => (
                <SortableTaskCard
                  key={task._id}
                  task={task}
                  index={index}
                  onCompleteTask={onCompleteTask}
                  onMove={handleMove}
                  onDeleteTask={onDeleteTask}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}

export default QueueColumn;
