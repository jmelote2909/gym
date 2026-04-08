import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Achievement {
  id: string;
  codigo?: string;
  nombre: string;
  descripcion?: string;
  icono?: string;
  categoria?: string;
  requisito_valor?: number;
  unlocked: boolean;
  unlockedAt?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  achievement: Achievement | null;
  onToggleUnlock: (achievement: Achievement) => Promise<void>;
  colors: any;
}

export default function AchievementDetailModal({ visible, onClose, achievement, onToggleUnlock, colors }: Props) {
  if (!achievement) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}>
            <View style={[styles.iconWrapper, { backgroundColor: achievement.unlocked ? colors.primary : colors.muted }]}>
              <Ionicons name={(achievement.icono || 'trophy') as any} size={32} color={achievement.unlocked ? colors.background : colors.secondary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.title, { color: colors.text }]}>{achievement.nombre}</Text>
              {achievement.unlocked && achievement.unlockedAt && (
                <Text style={[styles.sub, { color: colors.secondary }]}>Desbloqueado: {new Date(achievement.unlockedAt).toLocaleDateString()}</Text>
              )}
            </View>
          </View>

          <Text style={[styles.description, { color: colors.secondary }]}>{achievement.descripcion}</Text>

          <View style={{ marginTop: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.border }]} onPress={onClose}>
              <Text style={{ color: colors.text }}>Cerrar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: achievement.unlocked ? colors.background : colors.primary }]}
              onPress={() => achievement && onToggleUnlock(achievement)}
            >
              <Text style={{ color: achievement.unlocked ? colors.primary : colors.background, fontWeight: '700' }}>
                {achievement.unlocked ? 'Marcar como bloqueado' : 'Marcar como completado'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
  },
  sub: {
    fontSize: 12,
    marginTop: 4,
  },
  description: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
});