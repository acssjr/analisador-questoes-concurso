import { useNotifications, type Notification } from '../../hooks/useNotifications';
import { Badge } from '../ui';

function NotificationItem({ notification }: { notification: Notification }) {
  const removeNotification = useNotifications(state => state.removeNotification);

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  const variants = {
    success: 'success' as const,
    error: 'error' as const,
    warning: 'warning' as const,
    info: 'info' as const,
  };

  return (
    <div className="surface p-4 mb-3 animate-slideInRight shadow-lg max-w-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <span className="text-xl">{icons[notification.type]}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-medium text-text-primary">{notification.title}</h4>
              <Badge variant={variants[notification.type]}>
                {notification.type}
              </Badge>
            </div>
            {notification.message && (
              <p className="text-xs text-text-secondary">{notification.message}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => removeNotification(notification.id)}
          className="text-text-secondary hover:text-text-primary transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function NotificationCenter() {
  const notifications = useNotifications(state => state.notifications);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-6 z-50 max-w-md">
      {notifications.map(notification => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
    </div>
  );
}
