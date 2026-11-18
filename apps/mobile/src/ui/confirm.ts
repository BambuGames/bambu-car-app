import { Alert } from 'react-native';

// Resolves true when the confirm button is tapped; cancel or dismissing the dialog resolves false.
export const confirmAlert = (title: string, body: string, confirm: string, cancel: string, destructive = false) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(title, body, [
      { text: cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirm, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
