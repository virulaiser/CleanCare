import React, { useState } from 'react';
import { TouchableOpacity, Text, Modal, View, StyleSheet, Linking } from 'react-native';
import { colors } from '../constants/colors';

export default function SignatureBadge() {
  const [show, setShow] = useState(false);

  return (
    <>
      <TouchableOpacity style={styles.badge} onPress={() => setShow(true)} activeOpacity={0.7}>
        <Text style={styles.badgeIcon}>{'</>'}</Text>
      </TouchableOpacity>

      <Modal visible={show} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.icon}>{'</>'}</Text>
            <Text style={styles.title}>Desarrollado por</Text>
            <TouchableOpacity onPress={() => Linking.openURL('mailto:jsiutto@gmail.com')}>
              <Text style={styles.email}>jsiutto@gmail.com</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShow(false)}>
              <Text style={styles.closeText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  badgeIcon: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 32,
    width: '75%',
    alignItems: 'center',
  },
  icon: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  email: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 20,
  },
  closeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  closeText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
