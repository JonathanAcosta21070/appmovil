// app/farmer/alerts.js - OPTIMIZADO
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../../contexts/SyncContext';

// Constantes para tipos de alerta
const ALERT_TYPES = {
  warning: { icon: '⚠️', color: '#ff9800' },
  info: { icon: 'ℹ️', color: '#2196f3' },
  success: { icon: '✅', color: '#4caf50' },
  error: { icon: '❌', color: '#f44336' },
  default: { icon: '📢', color: '#666' }
};

const PRIORITY_CONFIG = {
  high: { color: '#f44336', text: 'ALTA PRIORIDAD' },
  medium: { color: '#ff9800', text: 'PRIORIDAD MEDIA' },
  low: { color: '#4caf50', text: 'PRIORIDAD BAJA' },
  default: { color: '#2196f3', text: 'PRIORIDAD NORMAL' }
};

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const { user, API_BASE_URL, isConnected, unsyncedCount } = useSync();

  // Memoizar valores computados
  const unreadCount = useMemo(() => alerts.filter(a => !a.read).length, [alerts]);
  const highPriorityCount = useMemo(() => alerts.filter(a => a.priority === 'high').length, [alerts]);

  // Funciones memoizadas
  const getAlertConfig = useCallback((type) => 
    ALERT_TYPES[type] || ALERT_TYPES.default, []);

  const getPriorityConfig = useCallback((priority) => 
    PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.default, []);

  // Cargar alertas
  const loadAlerts = useCallback(async () => {
    try {
      setIsLoading(true);
      
      if (isConnected && user?.id) {
        try {
          const response = await fetch(`${API_BASE_URL}/farmer/alerts`, {
            headers: { 'Authorization': user.id },
          });
          
          if (response.ok) {
            const serverAlerts = await response.json();
            await AsyncStorage.setItem('farmerAlerts', JSON.stringify(serverAlerts));
            setAlerts(serverAlerts);
            return;
          }
        } catch (serverError) {
          console.log('⚠️ Error cargando del servidor:', serverError);
        }
      }

      // Fallback a datos locales
      const alertsLocal = await AsyncStorage.getItem('farmerAlerts');
      if (alertsLocal) {
        setAlerts(JSON.parse(alertsLocal));
      }
    } catch (error) {
      console.error('Error cargando alertas:', error);
      Alert.alert('Error', 'No se pudieron cargar las recomendaciones');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [isConnected, user, API_BASE_URL]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAlerts();
  }, [loadAlerts]);

  // Marcar como leída
  const markAsRead = useCallback(async (alertId) => {
    try {
      // Actualizar localmente
      const updated = alerts.map(a =>
        (a.id === alertId || a._id === alertId) ? { ...a, read: true } : a
      );
      setAlerts(updated);
      await AsyncStorage.setItem('farmerAlerts', JSON.stringify(updated));

      // Sincronizar con servidor
      if (isConnected && user?.id) {
        try {
          await fetch(`${API_BASE_URL}/farmer/alerts/${alertId}/read`, {
            method: 'PUT',
            headers: { 'Authorization': user.id.toString(), 'Content-Type': 'application/json' }
          });
        } catch (serverError) {
          console.log('⚠️ Error sincronizando con servidor:', serverError);
        }
      }
    } catch (error) {
      console.error('Error marcando como leída:', error);
    }
  }, [alerts, isConnected, user, API_BASE_URL]);

  // Marcar todas como leídas
  const markAllAsRead = useCallback(async () => {
    try {
      const unreadAlerts = alerts.filter(a => !a.read);
      const unreadIds = unreadAlerts.map(a => a.id || a._id).filter(id => id);

      // Actualizar localmente
      const updated = alerts.map(a => ({ ...a, read: true }));
      setAlerts(updated);
      await AsyncStorage.setItem('farmerAlerts', JSON.stringify(updated));

      // Sincronizar con servidor
      if (isConnected && user?.id && unreadIds.length > 0) {
        const updatePromises = unreadIds.map(alertId =>
          fetch(`${API_BASE_URL}/farmer/alerts/${alertId}/read`, {
            method: 'PUT',
            headers: { 'Authorization': user.id.toString(), 'Content-Type': 'application/json' }
          }).then(response => response.ok)
            .catch(() => false)
        );

        const results = await Promise.all(updatePromises);
        const successfulUpdates = results.filter(result => result).length;
        console.log(`📊 Sincronización: ${successfulUpdates}/${unreadIds.length} alertas actualizadas`);
      }

      Alert.alert('Éxito', `Todas las recomendaciones (${unreadAlerts.length}) marcadas como leídas`);
    } catch (error) {
      console.error('Error marcando todas como leídas:', error);
      Alert.alert('Error', 'No se pudieron marcar todas las recomendaciones como leídas');
    }
  }, [alerts, isConnected, user, API_BASE_URL]);

  // Eliminar alerta
  const deleteAlert = useCallback(async (alertId) => {
    try {
      const alertToDelete = alerts.find(a => a.id === alertId || a._id === alertId);
      if (!alertToDelete) return;

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
                // Eliminar localmente
                const updated = alerts.filter(a => a.id !== alertId && a._id !== alertId);
                setAlerts(updated);
                await AsyncStorage.setItem('farmerAlerts', JSON.stringify(updated));

                // Eliminar del servidor
                if (isConnected && user?.id && alertToDelete._id) {
                  try {
                    await fetch(`${API_BASE_URL}/farmer/alerts/${alertToDelete._id}`, {
                      method: 'DELETE',
                      headers: { 'Authorization': user.id, 'Content-Type': 'application/json' }
                    });
                  } catch (serverError) {
                    console.log('⚠️ Error eliminando del servidor:', serverError);
                  }
                }
              } catch (error) {
                console.error('Error eliminando alerta:', error);
                Alert.alert('Error', 'No se pudo eliminar la recomendación');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error en deleteAlert:', error);
    }
  }, [alerts, isConnected, user, API_BASE_URL]);

  // Eliminar todas las alertas
  const deleteAllAlerts = useCallback(async () => {
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
              const alertsToDelete = [...alerts];
              setAlerts([]);
              await AsyncStorage.setItem('farmerAlerts', JSON.stringify([]));

              // Eliminar del servidor
              if (isConnected && user?.id) {
                const serverAlerts = alertsToDelete.filter(alert => alert._id);
                for (const alert of serverAlerts) {
                  try {
                    await fetch(`${API_BASE_URL}/farmer/alerts/${alert._id}`, {
                      method: 'DELETE',
                      headers: { 'Authorization': user.id, 'Content-Type': 'application/json' }
                    });
                  } catch (error) {
                    console.log(`⚠️ Error eliminando alerta ${alert._id}:`, error);
                  }
                }
              }

              Alert.alert('Éxito', 'Todas las recomendaciones eliminadas');
            } catch (error) {
              console.error('Error eliminando todas:', error);
              Alert.alert('Error', 'No se pudieron eliminar todas las recomendaciones');
            }
          },
        },
      ]
    );
  }, [alerts, isConnected, user, API_BASE_URL]);

  // Renderizado condicional
  const renderAlertCard = useCallback((alert) => {
    const alertConfig = getAlertConfig(alert.type);
    const priorityConfig = getPriorityConfig(alert.priority);

    return (
      <View
        key={alert.id || alert._id}
        style={[
          styles.alertCard,
          !alert.read && styles.unreadAlert,
          { borderLeftWidth: 4, borderLeftColor: priorityConfig.color }
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardIcon}>{alertConfig.icon}</Text>
            <View style={styles.cardTitleText}>
              <Text style={styles.cardName}>{alert.title}</Text>
              <Text style={styles.cardSubtitle}>Por: {alert.from}</Text>
            </View>
          </View>
          
          <View style={styles.alertActions}>
            {!alert.read && (
              <TouchableOpacity
                style={[styles.statusBadge, { backgroundColor: '#4caf50' }]}
                onPress={() => markAsRead(alert.id || alert._id)}
              >
                <Text style={styles.statusText}>✓ Leer</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.statusBadge, { backgroundColor: '#f44336' }]}
              onPress={() => deleteAlert(alert.id || alert._id)}
            >
              <Text style={styles.statusText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.alertMeta}>
          <View style={[styles.metaBadge, { backgroundColor: priorityConfig.color }]}>
            <Text style={styles.metaText}>{priorityConfig.text}</Text>
          </View>
        </View>

        {alert.crop && (
          <View style={styles.cropContainer}>
            <Text style={styles.cropLabel}>🌱 Cultivo:</Text>
            <Text style={styles.cropName}>{alert.crop}</Text>
          </View>
        )}

        <View style={styles.alertContent}>
          <Text style={styles.alertMessage}>{alert.message}</Text>
        </View>

        {alert.actions && alert.actions.length > 0 && (
          <View style={styles.actionsList}>
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
    );
  }, [getAlertConfig, getPriorityConfig, markAsRead, deleteAlert]);

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingText}>Cargando recomendaciones...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>💡 Recomendaciones Técnicas</Text>
        <Text style={styles.subtitle}>Asesoramiento de especialistas agrícolas</Text>
      </View>

      {/* Tarjeta principal */}
      <View style={styles.mainCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardIcon}>📋</Text>
            <View style={styles.cardTitleText}>
              <Text style={styles.cardName}>Resumen de Recomendaciones</Text>
              <Text style={styles.cardSubtitle}>Gestión de asesoramientos recibidos</Text>
            </View>
          </View>
          
          <View style={[styles.statusBadge, { backgroundColor: '#4caf50' }]}>
            <Text style={styles.statusText}>Activo</Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total:</Text>
            <Text style={styles.detailValue}>{alerts.length} recomendaciones</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>No leídas:</Text>
            <Text style={styles.detailValue}>{unreadCount}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Urgentes:</Text>
            <Text style={styles.detailValue}>{highPriorityCount}</Text>
          </View>
        </View>
      </View>

      {/* Acciones globales */}
      {(unreadCount > 0 || alerts.length > 0) && (
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>⚡ Acciones Rápidas</Text>
          
          <View style={styles.actionsGrid}>
            {unreadCount > 0 && (
              <TouchableOpacity style={styles.actionCard} onPress={markAllAsRead}>
                <View style={styles.actionContent}>
                  <Text style={styles.actionIcon}>📭</Text>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Marcar todas como leídas</Text>
                    <Text style={styles.actionSubtitle}>{unreadCount} sin leer</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {alerts.length > 0 && (
              <TouchableOpacity style={styles.actionCard} onPress={deleteAllAlerts}>
                <View style={styles.actionContent}>
                  <Text style={styles.actionIcon}>🗑️</Text>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Eliminar todas</Text>
                    <Text style={styles.actionSubtitle}>{alerts.length} recomendaciones</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Lista de recomendaciones */}
      <View style={styles.alertsSection}>
        <Text style={styles.sectionTitle}>📢 Recomendaciones Recibidas</Text>
        
        {alerts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No hay recomendaciones</Text>
            <Text style={styles.emptySubtext}>
              Los científicos te enviarán recomendaciones aquí cuando sea necesario
            </Text>
          </View>
        ) : (
          alerts.map(renderAlertCard)
        )}
      </View>

      {/* Información adicional */}
      <View style={styles.helpSection}>
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>💡 Información sobre Recomendaciones</Text>
          <View style={styles.helpList}>
            {[
              'Las recomendaciones son enviadas por científicos agrícolas',
              'Marca como leída cuando hayas revisado una recomendación',
              'Las recomendaciones urgentes tienen prioridad alta',
              'Puedes eliminar recomendaciones que ya no necesites'
            ].map((text, index) => (
              <View key={index} style={styles.helpItem}>
                <Text style={styles.helpIcon}>•</Text>
                <Text style={styles.helpText}>{text}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

// Estilos (se mantienen iguales)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  contentContainer: { padding: 16, paddingBottom: 60 },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  loadingText: { fontSize: 16, color: '#666', marginTop: 10 },
  header: { backgroundColor: '#2e7d32', padding: 20, borderRadius: 12, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: 'white', textAlign: 'center', opacity: 0.9 },
  connectionInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 16 },
  connectionStatus: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusOnline: { backgroundColor: '#4caf50' },
  statusOffline: { backgroundColor: '#f44336' },
  statusText: { fontSize: 14, color: '#333', fontWeight: '500' },
  unsyncedText: { fontSize: 12, color: '#ff9800', fontWeight: '500' },
  mainCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardTitleContainer: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, marginRight: 8 },
  cardIcon: { fontSize: 24, marginRight: 12, marginTop: 2 },
  cardTitleText: { flex: 1 },
  cardName: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  cardSubtitle: { fontSize: 14, color: '#666' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, minWidth: 80, alignItems: 'center' },
  cardDetails: { marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel: { fontSize: 14, color: '#666', fontWeight: '500' },
  detailValue: { fontSize: 14, color: '#333', fontWeight: '600' },
  actionsSection: { marginBottom: 16 },
  alertsSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  actionsGrid: { flexDirection: 'row', gap: 12 },
  actionCard: { flex: 1, backgroundColor: 'white', padding: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  actionContent: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  actionIcon: { fontSize: 32, marginBottom: 8 },
  actionTextContainer: { alignItems: 'center' },
  actionTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 4, textAlign: 'center' },
  actionSubtitle: { fontSize: 12, color: '#666', textAlign: 'center' },
  alertCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, position: 'relative' },
  unreadAlert: { backgroundColor: '#f8f9fa' },
  alertActions: { flexDirection: 'row', gap: 8 },
  alertMeta: { marginBottom: 8 },
  metaBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start' },
  metaText: { fontSize: 12, color: 'white', fontWeight: 'bold' },
  cropContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: '#f8f9fa', padding: 8, borderRadius: 8 },
  cropLabel: { fontSize: 14, color: '#666', fontWeight: '500', marginRight: 8 },
  cropName: { fontSize: 14, color: '#2e7d32', fontWeight: '600' },
  alertContent: { marginBottom: 12 },
  alertMessage: { fontSize: 14, color: '#555', lineHeight: 20 },
  actionsList: { backgroundColor: '#fff3e0', padding: 12, borderRadius: 8, marginBottom: 12 },
  actionsTitle: { fontSize: 14, fontWeight: 'bold', color: '#e65100', marginBottom: 8 },
  actionItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  actionBullet: { color: '#e65100', marginRight: 6, fontSize: 14 },
  actionText: { fontSize: 14, color: '#e65100', flex: 1, lineHeight: 18 },
  alertFooter: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 },
  alertDate: { fontSize: 12, color: '#666', textAlign: 'center' },
  unreadIndicator: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, backgroundColor: '#2e7d32', borderRadius: 4 },
  emptyCard: { backgroundColor: 'white', padding: 40, borderRadius: 12, alignItems: 'center' },
  emptyIcon: { fontSize: 32, marginBottom: 12, opacity: 0.5 },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 8, textAlign: 'center' },
  emptySubtext: { fontSize: 14, color: '#999', textAlign: 'center', fontStyle: 'italic' },
  helpSection: { marginBottom: 16 },
  helpCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  helpTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  helpList: { gap: 8 },
  helpItem: { flexDirection: 'row', alignItems: 'flex-start' },
  helpIcon: { marginRight: 8, fontSize: 14, color: '#666' },
  helpText: { fontSize: 14, color: '#666', flex: 1, lineHeight: 20 },
  bottomSpacing: { height: 40 },
});