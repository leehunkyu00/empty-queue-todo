function RecentCompleted({ items, onReopen }) {
  return (
    <section className="recent-completed">
      <h2>최근 클리어</h2>
      {items.length === 0 ? (
        <p>아직 최근 완료 작업이 없어요. 첫 성공을 만들어보세요!</p>
      ) : (
        <ul>
          {items.map((task) => (
            <li key={task._id}>
              <div>
                <strong>{task.title}</strong>
                <span className="queue-label">{task.queue === 'deep' ? 'Deep Work' : 'Admin'}</span>
              </div>
              <div className="recent-meta">
                <span>{task.assignedProfileName}</span>
                {task.completedAt ? (
                  <time dateTime={task.completedAt}>
                    {new Date(task.completedAt).toLocaleString()}
                  </time>
                ) : null}
              </div>
              {onReopen ? (
                <button
                  type="button"
                  className="recent-undo"
                  onClick={() => onReopen(task._id)}
                >
                  되돌리기
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default RecentCompleted;
