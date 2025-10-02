import { useEffect, useMemo, useRef, useState } from 'react';
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

function formatTimeRange(start, end) {
  const startTime = start ? dayjs(start).format('HH:mm') : '';
  const endTime = end ? dayjs(end).format('HH:mm') : '';
  return `${startTime} - ${endTime}`;
}

function computePosition(start, end, dayStart) {
  const startDate = dayjs(start);
  const endDate = dayjs(end);
  const top = Math.max(0, startDate.diff(dayStart, 'minute')) * MINUTE_HEIGHT;
  const durationMinutes = Math.max(15, endDate.diff(startDate, 'minute'));
  const height = durationMinutes * MINUTE_HEIGHT;
  return { top, height };
}

function DraggableTask({ task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task-${task._id}`,
    data: { task },
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className="schedule-task-card" {...attributes} {...listeners}>
      <div>
        <strong>{task.title}</strong>
        <span className={`schedule-task-queue queue-${task.queue}`}>{task.queue === 'deep' ? 'Deep Work' : 'Admin'}</span>
      </div>
      {task.estimatedMinutes ? <small>{task.estimatedMinutes}분 예상</small> : null}
    </li>
  );
}

function DroppableBlock({ block, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `block-${block._id}`,
    data: { block },
  });
  return (
    <div
      ref={setNodeRef}
      className={`schedule-block block-${block.type} ${isOver ? 'dropping' : ''}`}
      style={{ top: block.position.top, height: block.position.height }}
    >
      {children}
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
    setSubmitting(true);
    try {
      await onSubmit({ ...draft, type, title: title.trim() });
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

function CurrentBlockBanner({ block, onToggleTask, onUnassignTask, now }) {
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
          <span>{formatTimeRange(block.start, block.end)}</span>
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

function ScheduleView({
  date,
  onDateChange,
  blocks = [],
  unscheduled = [],
  loading,
  onCreateBlock,
  onDeleteBlock,
  onAssignTask,
  onUnassignTask,
  onToggleTask,
  onRefresh,
}) {
  const dayStart = useMemo(() => dayjs(date).startOf('day'), [date]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeDragTask, setActiveDragTask] = useState(null);
  const [selection, setSelection] = useState(null);
  const [blockDraft, setBlockDraft] = useState(null);
  const canvasRef = useRef(null);
  const [now, setNow] = useState(() => dayjs());

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 60000);
    return () => clearInterval(timer);
  }, []);

  const blocksWithPosition = useMemo(
    () =>
      (blocks || []).map((block) => ({
        ...block,
        position: computePosition(block.start, block.end, dayStart),
      })),
    [blocks, dayStart]
  );

  const isToday = useMemo(() => dayjs(date).isSame(now, 'day'), [date, now]);
  const currentBlock = useMemo(() => {
    if (!isToday) return null;
    const nowValue = now.valueOf();
    return (
      blocks.find((block) => {
        const start = dayjs(block.start).valueOf();
        const end = dayjs(block.end).valueOf();
        return start <= nowValue && nowValue < end;
      }) || null
    );
  }, [blocks, isToday, now]);

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('.schedule-block')) {
      return;
    }
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const minute = Math.max(0, Math.min(event.clientY - bounds.top, MINUTES_IN_DAY));
    setSelection({ startMinute: minute, endMinute: minute });
  };

  const handlePointerMove = (event) => {
    if (!selection) return;
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const minute = Math.max(0, Math.min(event.clientY - bounds.top, MINUTES_IN_DAY));
    setSelection((prev) => (prev ? { ...prev, endMinute: minute } : null));
  };

  const handlePointerUp = () => {
    if (!selection) return;
    const { startMinute, endMinute } = selection;
    const startMinuteRounded = Math.floor(Math.min(startMinute, endMinute) / 15) * 15;
    const endMinuteRounded = Math.ceil(Math.max(startMinute, endMinute) / 15) * 15;
    setSelection(null);
    if (!onCreateBlock) return;
    if (endMinuteRounded - startMinuteRounded < 15) {
      return;
    }
    const start = dayjs(date).startOf('day').add(startMinuteRounded, 'minute').toISOString();
    const end = dayjs(date).startOf('day').add(endMinuteRounded, 'minute').toISOString();
    setBlockDraft({ start, end });
  };

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
      <CurrentBlockBanner block={currentBlock} onToggleTask={onToggleTask} onUnassignTask={onUnassignTask} now={now} />

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
            onMouseLeave={() => setSelection(null)}
          >
            <div className="schedule-lines">
              {HOURS.map((hour) => (
                <div key={hour} className="schedule-line" style={{ top: hour * 60 * MINUTE_HEIGHT }} />
              ))}
            </div>
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
                <DroppableBlock key={block._id} block={block}>
                  <header className="schedule-block-header">
                    <div>
                      <span className="schedule-block-type">{block.type === 'deep' ? 'Deep Work' : 'Admin'}</span>
                      <strong>{block.title || (block.type === 'deep' ? '집중 블록' : 'Admin 블록')}</strong>
                      <span className="schedule-block-time-range">{formatTimeRange(block.start, block.end)}</span>
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
                      <button type="button" className="schedule-block-delete" onClick={() => onDeleteBlock(block)}>
                        삭제
                      </button>
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
                <p className="schedule-empty">모든 작업이 스케줄 되었습니다!</p>
              ) : (
                <ul>
                  {unscheduled.map((task) => (
                    <DraggableTask key={task._id} task={task} />
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
        onSubmit={async ({ start, end, type, title }) => {
          try {
            await onCreateBlock({ start, end, type, title });
            setBlockDraft(null);
          } catch (error) {
            // handled via toast in parent
          }
        }}
      />
    </div>
  );
}

export default ScheduleView;
