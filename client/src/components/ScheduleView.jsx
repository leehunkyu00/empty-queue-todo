import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTE_HEIGHT = 1; // 1px per minute keeps the canvas at 60px per hour
const MINUTES_IN_DAY = 24 * 60;
const MIN_BLOCK_DURATION_MINUTES = 15;

function resolveBlockMinutes(block, referenceDay) {
  if (!block) {
    return { startMinute: 0, endMinute: MIN_BLOCK_DURATION_MINUTES };
  }
  const baseStart = block.startMinuteOfDay;
  const baseEnd = block.endMinuteOfDay;
  let startMinute = Number.isFinite(baseStart) ? baseStart : dayjs(block.start).diff(referenceDay, 'minute');
  let endMinute = Number.isFinite(baseEnd) ? baseEnd : dayjs(block.end).diff(referenceDay, 'minute');

  if (!Number.isFinite(startMinute)) {
    startMinute = 0;
  }
  if (!Number.isFinite(endMinute)) {
    endMinute = startMinute + MIN_BLOCK_DURATION_MINUTES;
  }

  startMinute = Math.max(0, Math.min(startMinute, MINUTES_IN_DAY - MIN_BLOCK_DURATION_MINUTES));
  endMinute = Math.max(startMinute + MIN_BLOCK_DURATION_MINUTES, Math.min(endMinute, MINUTES_IN_DAY));
  endMinute = Math.min(endMinute, MINUTES_IN_DAY);

  return { startMinute, endMinute };
}

function formatTimeRange(block, dayStart) {
  if (!block) return '--:-- - --:--';
  const { startMinute, endMinute } = resolveBlockMinutes(block, dayStart);
  const startMoment = dayStart.add(startMinute, 'minute');
  const endMoment = dayStart.add(endMinute, 'minute');
  return `${startMoment.format('HH:mm')} - ${endMoment.format('HH:mm')}`;
}

function computePosition(block, dayStart) {
  const { startMinute, endMinute } = resolveBlockMinutes(block, dayStart);
  const durationMinutes = Math.max(MIN_BLOCK_DURATION_MINUTES, endMinute - startMinute);
  return {
    top: startMinute * MINUTE_HEIGHT,
    height: durationMinutes * MINUTE_HEIGHT,
    startMinute,
    endMinute,
  };
}

function DraggableTask({ task, onDoubleClick, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task-${task._id}`,
    data: { task },
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
  };
  const stopPropagation = (event) => {
    event.stopPropagation();
  };
  const handleDeleteClick = async (event) => {
    if (!onDelete || isDeleting) return;
    event.stopPropagation();
    event.preventDefault();
    setIsDeleting(true);
    try {
      await onDelete(task);
    } catch (error) {
      console.error('Failed to delete task', error);
    } finally {
      setIsDeleting(false);
    }
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="schedule-task-card"
      onDoubleClick={onDoubleClick}
      {...attributes}
      {...listeners}
    >
      <div className="schedule-task-card-header">
        <div className="schedule-task-card-meta">
          <strong>{task.title}</strong>
          <span className={`schedule-task-queue queue-${task.queue}`}>{task.queue === 'deep' ? 'Deep Work' : 'Admin'}</span>
        </div>
        {onDelete ? (
          <button
            type="button"
            className="schedule-task-delete"
            onPointerDown={stopPropagation}
            onClick={handleDeleteClick}
            disabled={isDeleting}
          >
            {isDeleting ? '삭제 중...' : '삭제'}
          </button>
        ) : null}
      </div>
    </li>
  );
}

function DroppableBlock({ block, children, onDoubleClick, onResizeStart }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `block-${block._id}`,
    data: { block },
  });
  return (
    <div
      ref={setNodeRef}
      className={`schedule-block block-${block.type} ${block.compact ? 'compact' : ''} ${isOver ? 'dropping' : ''}`}
      style={{ top: block.position.top, height: block.position.height }}
      onDoubleClick={onDoubleClick}
      title="더블클릭해서 편집"
    >
      <button
        type="button"
        className="schedule-block-resize-handle top"
        onPointerDown={(event) => onResizeStart(event, block, 'start')}
        aria-label="블록 시작 시간 조정"
      />
      {children}
      <button
        type="button"
        className="schedule-block-resize-handle bottom"
        onPointerDown={(event) => onResizeStart(event, block, 'end')}
        aria-label="블록 종료 시간 조정"
      />
    </div>
  );
}

function NewBlockModal({ draft, onSubmit, onCancel }) {
  const [type, setType] = useState('deep');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (draft) {
      setType('deep');
      setTitle('');
    }
  }, [draft]);

  if (!draft) return null;

  const handleCreate = async () => {
    if (submitting) return;
    const trimmedTitle = title.trim();
    setSubmitting(true);
    try {
      await onSubmit({
        ...draft,
        type,
        title: trimmedTitle ? trimmedTitle : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="schedule-manager-overlay" role="dialog" aria-modal="true">
      <div className="schedule-manager">
        <header>
          <h3>블록 만들기</h3>
          <button type="button" className="close-button" onClick={onCancel}>
            닫기
          </button>
        </header>
        <p>
          {dayjs(draft.start).format('HH:mm')} - {dayjs(draft.end).format('HH:mm')} 시간대를 어떤 작업 모드로 사용할까요?
        </p>
        <div className="block-type-selector">
          <label>
            <input type="radio" name="blockType" value="deep" checked={type === 'deep'} onChange={() => setType('deep')} />
            Deep Work
          </label>
          <label>
            <input type="radio" name="blockType" value="admin" checked={type === 'admin'} onChange={() => setType('admin')} />
            Admin
          </label>
        </div>
        <label>
          제목 (선택)
          <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 아침 집중" />
        </label>
        <div className="schedule-manager-actions">
          <button type="button" onClick={handleCreate} disabled={submitting}>
            {submitting ? '만드는 중...' : '만들기'}
          </button>
          <button type="button" className="danger" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

function EditBlockModal({ block, onSubmit, onDelete, onCancel }) {
  const [type, setType] = useState('deep');
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!block) return;
    setType(block.type || 'deep');
    setTitle(block.title || '');
    setStartTime(dayjs(block.start).format('HH:mm'));
    setEndTime(dayjs(block.end).format('HH:mm'));
    setError(null);
    setSubmitting(false);
    setDeleting(false);
  }, [block]);

  if (!block) return null;

  const handleSubmit = async () => {
    if (submitting) return;
    setError(null);
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    let nextError = null;
    if (
      Number.isNaN(startHour) ||
      Number.isNaN(startMinute) ||
      Number.isNaN(endHour) ||
      Number.isNaN(endMinute)
    ) {
      nextError = '시작/종료 시간을 다시 확인해주세요.';
    }
    const baseStart = dayjs(block.start).hour(startHour || 0).minute(startMinute || 0).second(0).millisecond(0);
    const baseEnd = dayjs(block.end).hour(endHour || 0).minute(endMinute || 0).second(0).millisecond(0);
    if (!nextError && !baseEnd.isAfter(baseStart)) {
      nextError = '종료 시간은 시작 시간 이후여야 합니다.';
    }
    if (nextError) {
      setError(nextError);
      return;
    }

    setSubmitting(true);
    try {
      const startMinuteOfDay = startHour * 60 + startMinute;
      const endMinuteOfDay = endHour * 60 + endMinute;
      await onSubmit({
        type,
        title: title?.trim() ? title.trim() : undefined,
        start: baseStart.toISOString(),
        end: baseEnd.toISOString(),
        startMinuteOfDay,
        endMinuteOfDay,
      });
    } catch (err) {
      setError(err?.message || '블록 저장에 실패했습니다.');
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete();
    } catch (err) {
      setError(err?.message || '블록 삭제에 실패했습니다.');
      setDeleting(false);
    }
  };

  return (
    <div className="schedule-manager-overlay" role="dialog" aria-modal="true">
      <div className="schedule-manager">
        <header className="schedule-editor-header">
          <h3>블록 수정</h3>
          <div className="schedule-editor-header-actions">
            <button type="button" className="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? '삭제 중...' : '삭제'}
            </button>
            <button type="button" className="close-button" onClick={onCancel}>
              닫기
            </button>
          </div>
        </header>
        <div className="block-type-selector">
          <label>
            <input type="radio" name="editBlockType" value="deep" checked={type === 'deep'} onChange={() => setType('deep')} />
            Deep Work
          </label>
          <label>
            <input type="radio" name="editBlockType" value="admin" checked={type === 'admin'} onChange={() => setType('admin')} />
            Admin
          </label>
        </div>
        <div className="schedule-time-inputs">
          <label>
            시작 시간
            <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </label>
          <label>
            종료 시간
            <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
          </label>
        </div>
        <label>
          제목
          <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="블록 제목" />
        </label>
        {error ? <p className="schedule-error">{error}</p> : null}
        <div className="schedule-manager-actions">
          <button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '저장 중...' : '저장하기'}
          </button>
          <button type="button" className="danger" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

function CurrentBlockBanner({ block, onToggleTask, onUnassignTask, now, dayStart }) {
  if (!block) {
    return (
      <section className="current-block-banner idle">
        <div>
          <h3>지금은 자유 시간입니다</h3>
          <p>예약된 블록이 없어요. 원하는 작업을 스케줄에 배치해보세요.</p>
        </div>
        <time>{dayjs(now).format('HH:mm')}</time>
      </section>
    );
  }

  const isDeep = block.type === 'deep';
  const tasks = block.tasks || [];

  return (
    <section className={`current-block-banner ${isDeep ? 'deep' : 'admin'}`}>
      <div className="current-block-meta">
        <h3>
          {isDeep ? '현재 모드: Deep Work' : '현재 모드: Admin'}
          <span>{formatTimeRange(block, dayStart)}</span>
        </h3>
        <p>{block.title || (isDeep ? '집중력을 높이기 위한 깊은 몰입 시간입니다.' : '빠르게 처리할 수 있는 작업들을 한 번에 끝내보세요.')}</p>
      </div>
      <div className="current-block-tasks">
        {tasks.length === 0 ? (
          <p>배정된 작업이 없습니다.</p>
        ) : (
          <ul>
            {tasks.map((task) => {
              const isCompleted = task.status === 'completed';
              return (
                <li key={task._id} className={isCompleted ? 'completed' : ''}>
                  <label>
                    <input
                      type="checkbox"
                      checked={isCompleted}
                      onChange={() => onToggleTask(task, !isCompleted)}
                    />
                    {task.title}
                  </label>
                  <button type="button" onClick={() => onUnassignTask(task)}>
                    해제
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <time>{dayjs(now).format('HH:mm')}</time>
    </section>
  );
}

function TaskEditorModal({ open, onClose, onSubmit, onDelete, activeProfile, task }) {
  const preferredQueue = activeProfile?.focusModePreference === 'admin' ? 'admin' : 'deep';
  const isEditing = Boolean(task);
  const buildInitialForm = useCallback(
    () => ({
      title: task?.title || '',
      description: task?.description || '',
      queue: task?.queue || preferredQueue,
      difficulty: task?.difficulty || 'medium',
    }),
    [task, preferredQueue]
  );

  const [form, setForm] = useState(() => buildInitialForm());
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(buildInitialForm());
      setSubmitting(false);
      setDeleting(false);
    }
  }, [open, buildInitialForm]);

  if (!open) return null;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || submitting) return;
    if (!activeProfile) return;

    setSubmitting(true);

    const payload = {
      queue: form.queue,
      title: form.title.trim(),
      description: form.description.trim(),
      difficulty: form.difficulty,
    };

    try {
      await onSubmit(payload);
      setForm(buildInitialForm());
      onClose();
    } catch (error) {
      console.error('Failed to submit task', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !onDelete || deleting) return;
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (error) {
      console.error('Failed to delete task', error);
      setDeleting(false);
    }
  };

  return (
    <div className="schedule-manager-overlay" role="dialog" aria-modal="true">
      <div className="schedule-manager schedule-task-creator">
        <header>
          <h3>{isEditing ? '작업 수정' : '작업 만들기'}</h3>
          <button type="button" className="close-button" onClick={onClose}>
            닫기
          </button>
        </header>
        <p className="schedule-task-assignee">
          담당: {activeProfile?.name || '선택된 계정 없음'}
        </p>
        <form className="schedule-task-form" onSubmit={handleSubmit}>
          <label>
            작업 제목
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="예: 사용자 인터뷰 정리"
              required
            />
          </label>
          <label>
            작업 설명 (선택)
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="상세 내용을 적어두면 나중에 도움이 됩니다."
            />
          </label>
          <div className="schedule-task-form-row">
            <label>
              큐 선택
              <select name="queue" value={form.queue} onChange={handleChange}>
                <option value="deep">Deep Work 큐</option>
                <option value="admin">Admin 큐</option>
              </select>
            </label>
            <label>
              난이도
              <select name="difficulty" value={form.difficulty} onChange={handleChange}>
                <option value="easy">쉬움</option>
                <option value="medium">보통</option>
                <option value="hard">어려움</option>
              </select>
            </label>
          </div>
          <div className="schedule-manager-actions">
            {isEditing && onDelete ? (
              <button
                type="button"
                className="danger"
                onClick={handleDelete}
                disabled={submitting || deleting}
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            ) : null}
            <button type="submit" disabled={submitting || deleting}>
              {submitting ? (isEditing ? '수정 중...' : '추가 중...') : isEditing ? '변경 저장' : '작업 추가'}
            </button>
            <button type="button" className="ghost" onClick={onClose} disabled={submitting || deleting}>
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScheduleView({
  date,
  onDateChange,
  blocks = [],
  unscheduled = [],
  loading,
  activeProfile,
  onCreateTask,
  onCreateBlock,
  onDeleteBlock,
  onUpdateBlock,
  onAssignTask,
  onUnassignTask,
  onToggleTask,
  onRefresh,
  onUpdateTask,
  onDeleteTask,
}) {
  const dayStart = useMemo(() => dayjs(date).startOf('day'), [date]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeDragTask, setActiveDragTask] = useState(null);
  const [selection, setSelection] = useState(null);
  const [blockDraft, setBlockDraft] = useState(null);
  const [editingBlock, setEditingBlock] = useState(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [hoverMinute, setHoverMinute] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [resizePreview, setResizePreview] = useState(null);
  const canvasRef = useRef(null);
  const resizingRef = useRef(null);
  const resizePreviewRef = useRef(null);
  const [now, setNow] = useState(() => dayjs());

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    resizingRef.current = resizing;
  }, [resizing]);

  useEffect(() => {
    resizePreviewRef.current = resizePreview;
  }, [resizePreview]);

  useEffect(() => {
    if (!onCreateTask) {
      setTaskModalOpen(false);
    }
  }, [onCreateTask]);

  useEffect(() => {
    if (!activeProfile) {
      setTaskModalOpen(false);
      setEditingTask(null);
    }
  }, [activeProfile]);

  useEffect(() => {
    if (!onUpdateTask) {
      setEditingTask(null);
    }
  }, [onUpdateTask]);

  useEffect(() => {
    if (!onDeleteTask) {
      setEditingTask(null);
    }
  }, [onDeleteTask]);

  const snapToQuarterHour = useCallback((minute) => {
    if (minute === null || Number.isNaN(minute)) return null;
    const clamped = Math.max(0, Math.min(minute, MINUTES_IN_DAY));
    return Math.round(clamped / 15) * 15;
  }, []);

  const getMinuteFromPointer = useCallback((clientY) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    const rawMinute = (clientY - bounds.top) / MINUTE_HEIGHT;
    if (Number.isNaN(rawMinute)) return null;
    return Math.max(0, Math.min(rawMinute, MINUTES_IN_DAY));
  }, []);

  const blocksWithPosition = useMemo(
    () =>
      (blocks || []).map((block) => {
        const preview = resizePreview?.blockId === block._id ? resizePreview : null;
        const startOverride = preview ? preview.start : undefined;
        const endOverride = preview ? preview.end : undefined;
        const startMinuteOverride = preview && Number.isFinite(preview.startMinuteOfDay) ? preview.startMinuteOfDay : undefined;
        const endMinuteOverride = preview && Number.isFinite(preview.endMinuteOfDay) ? preview.endMinuteOfDay : undefined;

        const enrichedBlock = {
          ...block,
          start: startOverride ?? block.start,
          end: endOverride ?? block.end,
          startMinuteOfDay: Number.isFinite(startMinuteOverride) ? startMinuteOverride : block.startMinuteOfDay,
          endMinuteOfDay: Number.isFinite(endMinuteOverride) ? endMinuteOverride : block.endMinuteOfDay,
        };

        const positionInfo = computePosition(enrichedBlock, dayStart);
        const startMoment = dayStart.add(positionInfo.startMinute, 'minute');
        const endMoment = dayStart.add(positionInfo.endMinute, 'minute');

        return {
          ...enrichedBlock,
          start: startMoment.toISOString(),
          end: endMoment.toISOString(),
          startMinuteOfDay: positionInfo.startMinute,
          endMinuteOfDay: positionInfo.endMinute,
          durationMinutes: positionInfo.endMinute - positionInfo.startMinute,
          position: { top: positionInfo.top, height: positionInfo.height },
        };
      }),
    [blocks, dayStart, resizePreview]
  );

  const isToday = useMemo(() => dayjs(date).isSame(now, 'day'), [date, now]);
  const nowLineOffset = useMemo(() => {
    if (!isToday) return null;
    return Math.max(0, Math.min(now.diff(dayStart, 'minute'), MINUTES_IN_DAY));
  }, [isToday, now, dayStart]);
  const currentBlock = useMemo(() => {
    if (!isToday) return null;
    const nowMinute = Math.max(0, Math.min(now.diff(dayStart, 'minute'), MINUTES_IN_DAY));
    return (
      blocksWithPosition.find((block) => {
        const startMinute = Number.isFinite(block.startMinuteOfDay) ? block.startMinuteOfDay : 0;
        const endMinute = Number.isFinite(block.endMinuteOfDay) ? block.endMinuteOfDay : startMinute;
        return startMinute <= nowMinute && nowMinute < endMinute;
      }) || null
    );
  }, [blocksWithPosition, dayStart, isToday, now]);

  const handlePointerDown = (event) => {
    if (resizingRef.current) return;
    if (event.button !== 0) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('.schedule-block')) {
      return;
    }
    const minuteValue = getMinuteFromPointer(event.clientY);
    if (minuteValue === null) return;
    const snapped = snapToQuarterHour(minuteValue);
    setSelection({ startMinute: snapped, endMinute: snapped });
    setHoverMinute(snapped);
  };

  const handlePointerMove = (event) => {
    if (resizingRef.current) return;
    const minuteValue = getMinuteFromPointer(event.clientY);
    if (minuteValue === null) return;
    const snapped = snapToQuarterHour(minuteValue);
    setHoverMinute(snapped);
    if (selection) {
      setSelection((prev) => (prev ? { ...prev, endMinute: snapped } : null));
    }
  };

  const handlePointerUp = () => {
    if (!selection) return;
    const { startMinute, endMinute } = selection;
    const startMinuteRounded = Math.floor(Math.min(startMinute, endMinute) / 15) * 15;
    const endMinuteRounded = Math.ceil(Math.max(startMinute, endMinute) / 15) * 15;
    setSelection(null);
    if (!onCreateBlock) return;
    if (endMinuteRounded - startMinuteRounded < MIN_BLOCK_DURATION_MINUTES) {
      return;
    }
    const startMoment = dayStart.add(startMinuteRounded, 'minute');
    const endMoment = dayStart.add(endMinuteRounded, 'minute');
    setBlockDraft({
      start: startMoment.toISOString(),
      end: endMoment.toISOString(),
      startMinuteOfDay: startMinuteRounded,
      endMinuteOfDay: endMinuteRounded,
    });
    setHoverMinute(null);
  };

  const handleResizePointerDown = (event, block, edge) => {
    if (!onUpdateBlock) return;
    event.preventDefault();
    event.stopPropagation();
    const startISO = dayjs(block.start).toISOString();
    const endISO = dayjs(block.end).toISOString();
    setResizing({
      blockId: block._id,
      edge,
      originalStart: startISO,
      originalEnd: endISO,
    });
    setResizePreview({
      blockId: block._id,
      start: startISO,
      end: endISO,
      startMinuteOfDay: Number.isFinite(block.startMinuteOfDay) ? block.startMinuteOfDay : dayjs(block.start).diff(dayStart, 'minute'),
      endMinuteOfDay: Number.isFinite(block.endMinuteOfDay) ? block.endMinuteOfDay : dayjs(block.end).diff(dayStart, 'minute'),
    });
  };

  useEffect(() => {
    if (!resizing) return undefined;

    const handlePointerMoveGlobal = (event) => {
      const minuteValue = getMinuteFromPointer(event.clientY);
      if (minuteValue === null) return;
      const snapped = snapToQuarterHour(minuteValue);
      setHoverMinute(snapped);

      const activeResize = resizingRef.current;
      if (!activeResize) return;
      const { blockId, edge, originalStart, originalEnd } = activeResize;
      const preview = resizePreviewRef.current && resizePreviewRef.current.blockId === blockId
        ? resizePreviewRef.current
        : { blockId, start: originalStart, end: originalEnd };

      const currentStart = dayjs(preview.start);
      const currentEnd = dayjs(preview.end);

      if (edge === 'start') {
        const currentEndMinute = Number.isFinite(preview.endMinuteOfDay) ? preview.endMinuteOfDay : currentEnd.diff(dayStart, 'minute');
        const maxMinute = currentEndMinute - MIN_BLOCK_DURATION_MINUTES;
        const clamped = Math.min(Math.max(snapped, 0), maxMinute);
        const nextStart = dayjs(dayStart).add(clamped, 'minute');
        setResizePreview({
          blockId,
          start: nextStart.toISOString(),
          end: currentEnd.toISOString(),
          startMinuteOfDay: clamped,
          endMinuteOfDay: currentEndMinute,
        });
      } else {
        const currentStartMinute = Number.isFinite(preview.startMinuteOfDay) ? preview.startMinuteOfDay : currentStart.diff(dayStart, 'minute');
        const minMinute = currentStartMinute + MIN_BLOCK_DURATION_MINUTES;
        const clamped = Math.max(Math.min(snapped, MINUTES_IN_DAY), minMinute);
        const nextEnd = dayjs(dayStart).add(clamped, 'minute');
        setResizePreview({
          blockId,
          start: currentStart.toISOString(),
          end: nextEnd.toISOString(),
          startMinuteOfDay: currentStartMinute,
          endMinuteOfDay: clamped,
        });
      }
    };

    const handlePointerUpGlobal = () => {
      const activeResize = resizingRef.current;
      resizingRef.current = null;
      setResizing(null);
      setHoverMinute(null);

      if (!activeResize) {
        setResizePreview(null);
        return;
      }

      const preview = resizePreviewRef.current && resizePreviewRef.current.blockId === activeResize.blockId
        ? resizePreviewRef.current
        : null;

      if (!preview) {
        setResizePreview(null);
        return;
      }

      if (
        preview.start === activeResize.originalStart &&
        preview.end === activeResize.originalEnd
      ) {
        setResizePreview(null);
        return;
      }

      if (!onUpdateBlock) {
        setResizePreview(null);
        return;
      }

      const minuteRange = resolveBlockMinutes({
        start: preview.start,
        end: preview.end,
        startMinuteOfDay: preview.startMinuteOfDay,
        endMinuteOfDay: preview.endMinuteOfDay,
      }, dayStart);

      Promise.resolve(onUpdateBlock(activeResize.blockId, {
        start: preview.start,
        end: preview.end,
        startMinuteOfDay: minuteRange.startMinute,
        endMinuteOfDay: minuteRange.endMinute,
      }))
        .catch(() => {})
        .finally(() => {
          setResizePreview(null);
        });
    };

    window.addEventListener('pointermove', handlePointerMoveGlobal);
    window.addEventListener('pointerup', handlePointerUpGlobal);
    return () => {
      window.removeEventListener('pointermove', handlePointerMoveGlobal);
      window.removeEventListener('pointerup', handlePointerUpGlobal);
    };
  }, [resizing, getMinuteFromPointer, snapToQuarterHour, dayStart, onUpdateBlock]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragTask(null);
    if (!over || !active?.data?.current?.task) return;
    const block = over.data?.current?.block;
    if (!block) return;
    await onAssignTask({
      blockId: block._id,
      taskId: active.data.current.task._id,
      start: block.start,
      end: block.end,
    });
  };

  return (
    <div className="schedule-container">
      <CurrentBlockBanner block={currentBlock} onToggleTask={onToggleTask} onUnassignTask={onUnassignTask} now={now} dayStart={dayStart} />

      <header className="schedule-header">
        <div className="schedule-date-controls">
          <button type="button" onClick={() => onDateChange(dayjs(date).subtract(1, 'day').format('YYYY-MM-DD'))}>
            ◀
          </button>
          <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
          <button type="button" onClick={() => onDateChange(dayjs(date).add(1, 'day').format('YYYY-MM-DD'))}>
            ▶
          </button>
          <button type="button" onClick={() => onDateChange(dayjs().format('YYYY-MM-DD'))}>
            오늘
          </button>
        </div>
        <div className="schedule-header-actions">
          {onCreateTask ? (
            <button
              type="button"
              className="schedule-create-task"
              onClick={() => setTaskModalOpen(true)}
              disabled={!activeProfile}
            >
              작업 추가
            </button>
          ) : null}
          <button type="button" onClick={onRefresh} className={loading ? 'refresh refreshing' : 'refresh'}>
            {loading ? '새로고침 중...' : '새로고침'}
          </button>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        onDragStart={(event) => setActiveDragTask(event.active.data.current?.task || null)}
        onDragEnd={handleDragEnd}
      >
        <div className="schedule-board">
          <div className="schedule-hours">
            {HOURS.map((hour) => (
              <div key={hour} className="schedule-hour-row">
                <span>{String(hour).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>
          <div
            className="schedule-canvas"
            ref={canvasRef}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={() => {
              setSelection(null);
              setHoverMinute(null);
            }}
          >
            <div className="schedule-lines">
              {HOURS.map((hour) => (
                <div key={hour} className="schedule-line" style={{ top: hour * 60 * MINUTE_HEIGHT }} />
              ))}
            </div>
            {hoverMinute !== null ? (
              <div className="schedule-hover-line" style={{ top: hoverMinute * MINUTE_HEIGHT }} />
            ) : null}
            {nowLineOffset !== null ? (
              <div className="schedule-now-line" style={{ top: nowLineOffset * MINUTE_HEIGHT }}>
                <span>{now.format('HH:mm')}</span>
              </div>
            ) : null}
            {selection ? (
              <div
                className="schedule-selection"
                style={{
                  top: Math.min(selection.startMinute, selection.endMinute),
                  height: Math.abs(selection.endMinute - selection.startMinute),
                }}
              />
            ) : null}
            <div className="schedule-blocks">
              {blocksWithPosition.map((block) => (
                <DroppableBlock
                  key={block._id}
                  block={{ ...block, compact: block.durationMinutes <= 30 }}
                  onDoubleClick={() => setEditingBlock(block)}
                  onResizeStart={handleResizePointerDown}
                >
                  <header className="schedule-block-header">
                    <div className="schedule-block-meta">
                      <span className="schedule-block-type">{block.type === 'deep' ? 'Deep Work' : 'Admin'}</span>
                      <strong>{block.title || (block.type === 'deep' ? '집중 블록' : 'Admin 블록')}</strong>
                      <span className="schedule-block-time-range">{formatTimeRange(block, dayStart)}</span>
                    </div>
                    <div className="schedule-block-tools">
                      {block.type === 'deep' ? (
                        <div className="schedule-block-summary deep">
                          {block.tasks && block.tasks.length > 0 ? block.tasks[0].title : '작업을 배치하세요'}
                        </div>
                      ) : (
                        <div className="schedule-block-summary admin">
                          {(block.tasks || []).length > 0 ? `${block.tasks.length}건 배정됨` : '작업을 배치하세요'}
                        </div>
                      )}
                    </div>
                  </header>
                </DroppableBlock>
              ))}
            </div>
          </div>
          <div className="schedule-sidebar">
            <section className="schedule-unscheduled">
              <h3>미배정 작업 ({unscheduled.length})</h3>
              {unscheduled.length === 0 ? (
                <div className="schedule-empty-state">
                  <p className="schedule-empty">모든 작업이 스케줄 되었습니다!</p>
                  {onCreateTask ? (
                    <button
                      type="button"
                      className="schedule-empty-create"
                      onClick={() => setTaskModalOpen(true)}
                      disabled={!activeProfile}
                    >
                      새 작업 만들기
                    </button>
                  ) : null}
                </div>
              ) : (
                <ul>
                  {unscheduled.map((task) => (
                    <DraggableTask
                      key={task._id}
                      task={task}
                      onDoubleClick={onUpdateTask ? () => setEditingTask(task) : undefined}
                      onDelete={onDeleteTask ? (currentTask) => onDeleteTask(currentTask._id) : undefined}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
        <DragOverlay>
          {activeDragTask ? <div className="schedule-task-card drag-overlay">{activeDragTask.title}</div> : null}
        </DragOverlay>
      </DndContext>

      <NewBlockModal
        draft={blockDraft}
        onCancel={() => setBlockDraft(null)}
        onSubmit={async ({ start, end, type, title, startMinuteOfDay, endMinuteOfDay }) => {
          try {
            await onCreateBlock({ start, end, type, title, startMinuteOfDay, endMinuteOfDay });
            setBlockDraft(null);
          } catch {
            // handled via toast in parent
          }
        }}
      />
      <EditBlockModal
        block={editingBlock}
        onCancel={() => setEditingBlock(null)}
        onSubmit={async (updates) => {
          if (!editingBlock) return;
          await onUpdateBlock(editingBlock._id, updates);
          setEditingBlock(null);
        }}
        onDelete={async () => {
          if (!editingBlock) return;
          await onDeleteBlock(editingBlock);
          setEditingBlock(null);
        }}
      />
      {onCreateTask ? (
        <TaskEditorModal
          open={taskModalOpen}
          onClose={() => setTaskModalOpen(false)}
          onSubmit={(payload) => onCreateTask(payload)}
          activeProfile={activeProfile}
        />
      ) : null}
      {onUpdateTask && editingTask ? (
        <TaskEditorModal
          open={Boolean(editingTask)}
          onClose={() => setEditingTask(null)}
          onSubmit={(payload) => onUpdateTask(editingTask._id, payload)}
          onDelete={onDeleteTask ? () => onDeleteTask(editingTask._id) : undefined}
          activeProfile={activeProfile}
          task={editingTask}
        />
      ) : null}
    </div>
  );
}

export default ScheduleView;
