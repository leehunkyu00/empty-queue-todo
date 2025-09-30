function FocusBanner({ deepQueue, adminQueue }) {
  const focusItems = [
    { queue: deepQueue, label: 'Deep Work' },
    { queue: adminQueue, label: 'Admin' },
  ];

  const hasFocusTask = focusItems.some((item) => item.queue?.focusTask);

  return (
    <section className="focus-banner">
      <div>
        <h2>오늘의 포커스</h2>
        <p>가장 위에 있는 작업부터 처리하면 큐를 빠르게 비울 수 있어요.</p>
      </div>
      <div className="focus-items">
        {focusItems.map(({ queue, label }) => (
          <div key={label} className="focus-item">
            <h3>{label}</h3>
            {queue?.focusTask ? (
              <>
                <strong>{queue.focusTask.title}</strong>
                <span>{queue.focusTask.assignedProfileName}</span>
              </>
            ) : (
              <span className="focus-empty">모든 작업 완료!</span>
            )}
          </div>
        ))}
      </div>
      {!hasFocusTask ? <p className="focus-congrats">두 큐 모두 비워졌어요. 멋져요! ✨</p> : null}
    </section>
  );
}

export default FocusBanner;
