function Toast({ message, tone = 'info' }) {
  return (
    <div className={`toast toast-${tone}`}>
      {message}
    </div>
  );
}

export default Toast;
