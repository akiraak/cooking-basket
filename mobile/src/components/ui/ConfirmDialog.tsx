import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../theme/theme-provider';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = '削除',
  cancelText = 'キャンセル',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const colors = useThemeColors();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
          <View style={styles.buttons}>
            <TouchableOpacity style={[styles.button, { borderColor: colors.border }]} onPress={onCancel}>
              <Text style={[styles.buttonText, { color: colors.textMuted }]}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, { backgroundColor: colors.danger }]} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); onConfirm(); }}>
              <Text style={[styles.buttonText, { color: '#fff' }]}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  dialog: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    marginBottom: 20,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
