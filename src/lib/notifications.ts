import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

export async function scheduleTrainingReminder(firstName: string = 'GymBro') {
  // Clear existing reminders
  await Notifications.cancelAllScheduledNotificationsAsync();

  const messages = [
    { title: `💪 ¡Dale caña, ${firstName}!`, body: "Tus metas no se van a cumplir solas. ¡Al lío!" },
    { title: "🏋️‍♂️ ¿Entrenamos?", body: "Un entrenamiento de 15 min es mejor que 0 min. ¡Vamos!" },
    { title: "🔥 Mantén el fuego", body: "Tu racha te lo agradecerá. ¡Nos vemos en el gym!" },
    { title: "🚀 Modo Bestia", body: "Es momento de superar tus límites. ¿Estás listo?" }
  ];

  const randomMsg = messages[Math.floor(Math.random() * messages.length)];

  // Schedule a daily reminder
  await Notifications.scheduleNotificationAsync({
    content: {
      title: randomMsg.title,
      body: randomMsg.body,
      data: { url: '/workout/active' },
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      hour: 18,
      minute: 0,
      repeats: true,
    },
  });
}

export async function scheduleStreakWarning(firstName: string = 'campeón') {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🔥 ¡${firstName}, tu racha!`,
      body: "Sólo faltan unas horas para que termine el día. ¡No dejes que se apague el fuego!",
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: {
        hour: 20,
        minute: 0,
        repeats: true,
    },
  });
}

