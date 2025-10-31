// app/farmer/alerts.js - VERSIÓN FINAL CORREGIDA (maneja id o _id correctamente)
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../../contexts/SyncContext';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, API_BASE_URL, isConnected } = useSync();

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setIsLoading(true);
      if (isConnected && user?.id) {
        try {
          const response = await fetch(`${API_BASE_URL}/farmer/alerts`, {
            headers: { 'Authorization': user.id },
          });
          if (response.ok) {
            const serverAlerts = await response.json();
            console.log('✅ Alertas cargadas del servidor:', serverAlerts.length);
            await AsyncStorage.setItem('farmerAlerts', JSON.stringify(serverAlerts));
            setAlerts(serverAlerts);
            setIsLoading(false);
            return;
          }
        } catch (serverError) {
          console.log('⚠️ Error cargando del servidor, usando datos locales:', serverError);
        }
      }

      const alertsLocal = await AsyncStorage.getItem('farmerAlerts');
      if (alertsLocal) {
        const parsed = JSON.parse(alertsLocal);
        console.log('📱 Alertas cargadas localmente:', parsed.length);
        setAlerts(parsed);
      }
    } catch (error) {
      console.log('❌ Error cargando alertas:', error);
      Alert.alert('Error', 'No se pudieron cargar las recomendaciones');
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (alertId) => {
    try {
      console.log('📖 Marcando como leída la alerta:', alertId);
      const updated = alerts.map(a =>
        (a.id === alertId || a._id === alertId) ? { ...a, read: true } : a
      );
      setAlerts(updated);
      await AsyncStorage.setItem('farmerAlerts', JSON.stringify(updated));
      console.log('✅ Alerta marcada como leída');
    } catch (error) {
      console.log('❌ Error marcando como leída:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const updated = alerts.map(a => ({ ...a, read: true }));
      setAlerts(updated);
      await AsyncStorage.setItem('farmerAlerts', JSON.stringify(updated));
      Alert.alert('Éxito', 'Todas las recomendaciones marcadas como leídas');
    } catch (error) {
      console.log('❌ Error marcando todas como leídas:', error);
    }
  };

  const deleteAlert = async (alertId) => {
    try {
      const alertToDelete = alerts.find(a => a.id === alertId || a._id === alertId);
      if (!alertToDelete) {
        console.log('⚠️ No se encontró alerta con ID:', alertId);
        return;
      }

      Alert.alert(
        'Eliminar Recomendación',
        `¿Eliminar "${alertToDelete.title}"?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              try {
                const updated = alerts.filter(a => a.id !== alertId && a._id !== alertId);
                setAlerts(updated);
                await AsyncStorage.setItem('farmerAlerts', JSON.stringify(updated));
                console.log(`✅ Alerta ${alertId} eliminada correctamente`);
              } catch (error) {
                console.log('❌ Error al eliminar alerta:', error);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.log('❌ Error en deleteAlert:', error);
    }
  };

  const deleteAllAlerts = async () => {
    if (alerts.length === 0) {
      Alert.alert('Info', 'No hay recomendaciones para eliminar');
      return;
    }

    Alert.alert(
      'Eliminar Todas',
      `¿Eliminar las ${alerts.length} recomendaciones?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar Todas',
          style: 'destructive',
          onPress: async () => {
            try {
              setAlerts([]);
              await AsyncStorage.setItem('farmerAlerts', JSON.stringify([]));
              Alert.alert('Éxito', 'Todas las recomendaciones eliminadas');
            } catch (error) {
              console.log('❌ Error eliminando todas:', error);
            }
          },
        },
      ]
    );
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      case 'success': return '✅';
      case 'error': return '❌';
      default: return '📢';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#f44336';
      case 'medium': return '#ff9800';
      case 'low': return '#4caf50';
      default: return '#2196f3';
    }
  };

  const getPriorityText = (priority) => {
    switch (priority) {
      case 'high': return 'ALTA PRIORIDAD';
      case 'medium': return 'PRIORIDAD MEDIA';
      case 'low': return 'PRIORIDAD BAJA';
      default: return 'PRIORIDAD NORMAL';
    }
  };

  const getUnreadCount = () => alerts.filter(a => !a.read).length;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando recomendaciones...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>💡 Recomendaciones Técnicas</Text>
        <Text style={styles.subtitle}>Asesoramiento de especialistas agrícolas</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{alerts.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{getUnreadCount()}</Text>
            <Text style={styles.statLabel}>No leídas</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{alerts.filter(a => a.priority === 'high').length}</Text>
            <Text style={styles.statLabel}>Urgentes</Text>
          </View>
        </View>

        <View style={styles.globalActions}>
          {getUnreadCount() > 0 && (
            <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
              <Text style={styles.markAllText}>📭 Marcar todas como leídas</Text>
            </TouchableOpacity>
          )}
          {alerts.length > 0 && (
            <TouchableOpacity style={styles.deleteAllButton} onPress={deleteAllAlerts}>
              <Text style={styles.deleteAllText}>🗑️ Eliminar todas</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {alerts.length > 0 ? (
        <View style={styles.alertsList}>
          {alerts.map((alert) => (
            <View
              key={alert.id || alert._id}
              style={[
                styles.alertCard,
                !alert.read && styles.unreadAlert,
                { borderLeftColor: getPriorityColor(alert.priority) }
              ]}
            >
              <View style={styles.alertHeader}>
                <View style={styles.alertTitleContainer}>
                  <Text style={styles.alertIcon}>{getAlertIcon(alert.type)}</Text>
                  <View style={styles.alertTitleWrapper}>
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                    <Text style={styles.alertFrom}>Por: {alert.from}</Text>
                  </View>
                </View>
                <View style={styles.alertActions}>
                  {!alert.read && (
                    <TouchableOpacity
                      style={styles.readButton}
                      onPress={() => markAsRead(alert.id || alert._id)}
                    >
                      <Text style={styles.readButtonText}>✓ Leer</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteAlert(alert.id || alert._id)}
                  >
                    <Text style={styles.deleteButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.alertMeta}>
                <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(alert.priority) }]}>
                  <Text style={styles.priorityText}>{getPriorityText(alert.priority)}</Text>
                </View>
                {alert.crop && (
                  <View style={styles.cropBadge}>
                    <Text style={styles.cropText}>🌱 {alert.crop}</Text>
                  </View>
                )}
              </View>

              <View style={styles.messageContainer}>
                <Text style={styles.alertMessage}>{alert.message}</Text>
              </View>

              {alert.actions && alert.actions.length > 0 && (
                <View style={styles.actionsContainer}>
                  <Text style={styles.actionsTitle}>📋 Acciones recomendadas:</Text>
                  {alert.actions.map((action, i) => (
                    <View key={`${alert.id || alert._id}-action-${i}`} style={styles.actionItem}>
                      <Text style={styles.actionBullet}>•</Text>
                      <Text style={styles.actionText}>{action}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.alertFooter}>
                <Text style={styles.alertDate}>
                  📅 {new Date(alert.date).toLocaleString('es-MX')}
                </Text>
              </View>

              {!alert.read && <View style={styles.unreadIndicator} />}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No hay recomendaciones</Text>
        </View>
      )}

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

// --- ESTILOS (idénticos al tuyo actual) ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#666' },
  header: { backgroundColor: '#2e7d32', padding: 20, paddingTop: 50 },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', textAlign: 'center' },
  subtitle: { fontSize: 16, color: 'white', textAlign: 'center', marginBottom: 20 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  statLabel: { fontSize: 12, color: 'white', opacity: 0.8 },
  globalActions: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  markAllButton: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 20 },
  markAllText: { color: 'white', fontWeight: '600' },
  deleteAllButton: { backgroundColor: 'rgba(244,67,54,0.8)', padding: 10, borderRadius: 20 },
  deleteAllText: { color: 'white', fontWeight: '600' },
  alertsList: { padding: 16 },
  alertCard: { backgroundColor: 'white', padding: 20, borderRadius: 12, marginBottom: 16, borderLeftWidth: 6 },
  unreadAlert: { backgroundColor: '#f8f9fa' },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  alertTitleContainer: { flexDirection: 'row', alignItems: 'flex-start', flex: 1 },
  alertIcon: { fontSize: 24, marginRight: 12 },
  alertTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  alertFrom: { fontSize: 14, color: '#666' },
  alertActions: { flexDirection: 'row', gap: 8 },
  readButton: { backgroundColor: '#4caf50', padding: 8, borderRadius: 8 },
  readButtonText: { color: 'white', fontWeight: 'bold' },
  deleteButton: { backgroundColor: '#f44336', padding: 8, borderRadius: 8 },
  deleteButtonText: { color: 'white', fontWeight: 'bold' },
  priorityBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  priorityText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  cropBadge: { backgroundColor: '#e8f5e8', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  cropText: { color: '#2e7d32', fontSize: 12 },
  messageContainer: { marginBottom: 12 },
  alertMessage: { fontSize: 16, color: '#555' },
  actionsContainer: { backgroundColor: '#fff3e0', padding: 10, borderRadius: 8 },
  actionsTitle: { fontWeight: 'bold', color: '#e65100' },
  actionItem: { flexDirection: 'row' },
  actionBullet: { color: '#e65100', marginRight: 6 },
  actionText: { color: '#e65100' },
  alertFooter: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 },
  alertDate: { textAlign: 'center', color: '#666' },
  unreadIndicator: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, backgroundColor: '#2e7d32', borderRadius: 4 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 64, marginBottom: 20 },
  emptyText: { fontSize: 18, color: '#666' },
  bottomSpace: { height: 40 },
});
