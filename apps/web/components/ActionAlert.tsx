export function ActionAlert({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <div className="action-alert" role="alert">
      {message}
    </div>
  );
}
