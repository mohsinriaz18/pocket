import { Platform } from 'react-native';
import { supabase } from './supabase';

async function permission() {
  if (Platform.OS === 'web') throw new Error('Scheduled daily reminders require the iOS or Android app. They are not available in the web preview.');
  const Notifications = await import('expo-notifications');
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('pocket-reminders', { name: 'Daily reminder', importance: Notifications.AndroidImportance.DEFAULT });
  let access = await Notifications.getPermissionsAsync();
  if (!access.granted) access = await Notifications.requestPermissionsAsync();
  if (!access.granted) throw new Error('Notification permission was denied. Enable Pocket notifications in your device Settings to use reminders.');
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
  return Notifications;
}
export async function scheduleReminder(enabled: boolean, time: string): Promise<void> {
  if (!enabled) {
    if (Platform.OS !== 'web') await (await import('expo-notifications')).cancelAllScheduledNotificationsAsync();
    return;
  }
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Enter a reminder time as HH:MM in 24-hour time.');
  const Notifications = await permission();
  const [hour, minute] = time.split(':').map(Number);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please log in to enable reminders.');
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const { count, error } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('date', today);
  if (error) throw new Error(error.message);
  await Notifications.cancelAllScheduledNotificationsAsync();
  // Bounded native local schedule. Rebuilt on app open and after entries change.
  // No false claim of remote/background synchronization when the app is closed.
  for (let day = 0; day < 30; day++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, hour, minute);
    if (date <= now || (day === 0 && (count ?? 0) > 0)) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Pocket', body: 'Remind me to log entries', data: { pocketReminder: true } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'pocket-reminders' },
    });
  }
}
export async function sendTestNotification(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof Notification === 'undefined') throw new Error('Notifications are not supported in this browser.');
    const access = await Notification.requestPermission();
    if (access !== 'granted') throw new Error('Notification permission was denied.');
    new Notification('Pocket', { body: 'Remind me to log entries' });
    return;
  }
  const Notifications = await permission();
  await Notifications.scheduleNotificationAsync({ content: { title: 'Pocket', body: 'Remind me to log entries' }, trigger: null });
}
