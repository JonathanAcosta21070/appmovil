// app/farmer/alerts.js - VERSIÓN CON ESTILO DE HOME FARMER
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../../contexts/SyncContext';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, API_BASE_URL, isConnected, unsyncedCount } = useSync();

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
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
  };

  const markAsRead = async (alertId) => {
    try {
      console.log('📖 Marcando como leída la alerta:', alertId);
      
      // 1. Actualizar localmente
      const updated = alerts.map(a =>
        (a.id === alertId || a._id === alertId) ? { ...a, read: true } : a
      );
      setAlerts(updated);
      await AsyncStorage.setItem('farmerAlerts', JSON.stringify(updated));
      console.log('✅ Alerta marcada como leída localmente');

      // 2. Intentar actualizar en el servidor
      if (isConnected && user?.id) {
        const mongoId = alertId;
        
        try {
          const response = await fetch(`${API_BASE_URL}/farmer/alerts/${mongoId}/read`, {
            method: 'PUT',
            headers: {
              'Authorization': user.id.toString(),
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            console.log(`📖 Recomendación ${mongoId} marcada como leída en servidor`);
          } else {
            console.log('⚠️ No se pudo marcar como leída en servidor');
          }
        } catch (serverError) {
          console.log('⚠️ Error de conexión al marcar como leída:', serverError);
        }
      }

    } catch (error) {
      console.log('❌ Error marcando como leída:', error);
    }
  };

  // 🔹 FUNCIÓN CORREGIDA PARA MARCAR TODAS COMO LEÍDAS
  const markAllAsRead = async () => {
    try {
      console.log('📖 Marcando TODAS las alertas como leídas...');
      
      // 1. Obtener IDs de alertas no leídas para sincronización con servidor
      const unreadAlerts = alerts.filter(a => !a.read);
      const unreadIds = unreadAlerts.map(a => a.id || a._id).filter(id => id);
      
      console.log(`📋 ${unreadAlerts.length} alertas no leídas encontradas`);

      // 2. Actualizar localmente
      const updated = alerts.map(a => ({ ...a, read: true }));
      setAlerts(updated);
      await AsyncStorage.setItem('farmerAlerts', JSON.stringify(updated));
      console.log('✅ Todas las alertas marcadas como leídas localmente');

      // 3. Intentar actualizar en el servidor para cada alerta no leída
      if (isConnected && user?.id && unreadIds.length > 0) {
        console.log('🔄 Sincronizando con servidor...');
        
        const updatePromises = unreadIds.map(async (alertId) => {
          try {
            const response = await fetch(`${API_BASE_URL}/farmer/alerts/${alertId}/read`, {
              method: 'PUT',
              headers: {
                'Authorization': user.id.toString(),
                'Content-Type': 'application/json'
              }
            });

            if (response.ok) {
              console.log(`✅ Alerta ${alertId} marcada como leída en servidor`);
              return true;
            } else {
              console.log(`⚠️ No se pudo marcar alerta ${alertId} como leída en servidor`);
              return false;
            }
          } catch (serverError) {
            console.log(`⚠️ Error de conexión al marcar alerta ${alertId}:`, serverError);
            return false;
          }
        });

        // Esperar a que todas las actualizaciones se completen
        const results = await Promise.all(updatePromises);
        const successfulUpdates = results.filter(result => result).length;
        
        console.log(`📊 Resultado sincronización: ${successfulUpdates}/${unreadIds.length} alertas actualizadas en servidor`);
      }

      Alert.alert('Éxito', `Todas las recomendaciones (${unreadAlerts.length}) marcadas como leídas`);

    } catch (error) {
      console.log('❌ Error marcando todas como leídas:', error);
      Alert.alert('Error', 'No se pudieron marcar todas las recomendaciones como leídas');
    }
  };

  // 🗑️ ELIMINAR ALERTA - CON SINCRONIZACIÓN CON MONGODB
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
                // 1. Eliminar localmente primero
                const updated = alerts.filter(a => a.id !== alertId && a._id !== alertId);
                setAlerts(updated);
                await AsyncStorage.setItem('farmerAlerts', JSON.stringify(updated));
                console.log(`✅ Alerta ${alertId} eliminada localmente`);

                // 2. Intentar eliminar en MongoDB si hay conexión y usuario
                if (isConnected && user?.id && alertToDelete._id) {
                  try {
                    const response = await fetch(`${API_BASE_URL}/farmer/alerts/${alertToDelete._id}`, {
                      method: 'DELETE',
                      headers: {
                        'Authorization': user.id,
                        'Content-Type': 'application/json'
                      }
                    });

                    if (response.ok) {
                      console.log(`🗑️ Alerta ${alertToDelete._id} eliminada de MongoDB`);
                    } else {
                      console.log('⚠️ No se pudo eliminar la alerta del servidor, pero se eliminó localmente');
                    }
                  } catch (serverError) {
                    console.log('⚠️ Error eliminando alerta en servidor, pero eliminada localmente:', serverError);
                  }
                }

              } catch (error) {
                console.log('❌ Error al eliminar alerta:', error);
                Alert.alert('Error', 'No se pudo eliminar la recomendación');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.log('❌ Error en deleteAlert:', error);
    }
  };

  // 🗑️ ELIMINAR TODAS LAS ALERTAS - CON SINCRONIZACIÓN CON MONGODB
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
              // Guardar referencias para eliminar en servidor
              const alertsToDelete = [...alerts];
              
              // 1. Eliminar localmente
              setAlerts([]);
              await AsyncStorage.setItem('farmerAlerts', JSON.stringify([]));
              console.log('✅ Todas las alertas eliminadas localmente');

              // 2. Intentar eliminar en MongoDB si hay conexión y usuario
              if (isConnected && user?.id) {
                const serverAlerts = alertsToDelete.filter(alert => alert._id);
                
                if (serverAlerts.length > 0) {
                  console.log(`🗑️ Intentando eliminar ${serverAlerts.length} alertas del servidor...`);
                  
                  // Eliminar cada alerta del servidor
                  for (const alert of serverAlerts) {
                    try {
                      await fetch(`${API_BASE_URL}/farmer/alerts/${alert._id}`, {
                        method: 'DELETE',
                        headers: {
                          'Authorization': user.id,
                          'Content-Type': 'application/json'
                        }
                      });
                      console.log(`🗑️ Alerta ${alert._id} eliminada del servidor`);
                    } catch (error) {
                      console.log(`⚠️ Error eliminando alerta ${alert._id} del servidor:`, error);
                    }
                  }
                }
              }

              Alert.alert('Éxito', 'Todas las recomendaciones eliminadas');
            } catch (error) {
              console.log('❌ Error eliminando todas:', error);
              Alert.alert('Error', 'No se pudieron eliminar todas las recomendaciones');
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
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingText}>Cargando recomendaciones...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={true}
    >
      {/* 🔹 Header - Mismo estilo que Home Farmer */}
      <View style={styles.header}>
        <Text style={styles.title}>💡 Recomendaciones Técnicas</Text>
        <Text style={styles.subtitle}>
          Asesoramiento de especialistas agrícolas
        </Text>
      </View>

      {/* 🔹 Información de conexión - Mismo estilo que Home Farmer */}
      <View style={styles.connectionInfo}>
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, isConnected ? styles.statusOnline : styles.statusOffline]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Conectado' : 'Sin conexión'}
          </Text>
        </View>
        
        {unsyncedCount > 0 && (
          <Text style={styles.unsyncedText}>
            📱 {unsyncedCount} pendientes
          </Text>
        )}
      </View>

      {/* 🔹 Tarjeta principal - Mismo estilo que Home Farmer */}
      <View style={styles.mainCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardIcon}>📋</Text>
            <View style={styles.cardTitleText}>
              <Text style={styles.cardName}>Resumen de Recomendaciones</Text>
              <Text style={styles.cardSubtitle}>
                Gestión de asesoramientos recibidos
              </Text>
            </View>
          </View>
          
          <View style={[styles.statusBadge, { backgroundColor: '#4caf50' }]}>
            <Text style={styles.statusText}>
              Activo
            </Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total:</Text>
            <Text style={styles.detailValue}>
              {alerts.length} recomendaciones
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>No leídas:</Text>
            <Text style={styles.detailValue}>
              {getUnreadCount()}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Urgentes:</Text>
            <Text style={styles.detailValue}>
              {alerts.filter(a => a.priority === 'high').length}
            </Text>
          </View>
        </View>
      </View>

      {/* 🔹 Acciones globales - Mismo estilo de tarjetas */}
      {(getUnreadCount() > 0 || alerts.length > 0) && (
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>⚡ Acciones Rápidas</Text>
          
          <View style={styles.actionsGrid}>
            {getUnreadCount() > 0 && (
              <TouchableOpacity style={styles.actionCard} onPress={markAllAsRead}>
                <View style={styles.actionContent}>
                  <Text style={styles.actionIcon}>📭</Text>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Marcar todas como leídas</Text>
                    <Text style={styles.actionSubtitle}>{getUnreadCount()} sin leer</Text>
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

      {/* 🔹 Lista de recomendaciones - Mismo estilo de tarjetas */}
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
          alerts.map((alert) => (
            <View
              key={alert.id || alert._id}
              style={[
                styles.alertCard,
                !alert.read && styles.unreadAlert,
                { borderLeftWidth: 4, borderLeftColor: getPriorityColor(alert.priority) }
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleContainer}>
                  <Text style={styles.cardIcon}>{getAlertIcon(alert.type)}</Text>
                  <View style={styles.cardTitleText}>
                    <Text style={styles.cardName}>{alert.title}</Text>
                    <Text style={styles.cardSubtitle}>
                      Por: {alert.from}
                    </Text>
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

              {/* Prioridad - AHORA EL CULTIVO ESTÁ DEBAJO */}
              <View style={styles.alertMeta}>
                <View style={[styles.metaBadge, { backgroundColor: getPriorityColor(alert.priority) }]}>
                  <Text style={styles.metaText}>{getPriorityText(alert.priority)}</Text>
                </View>
              </View>

              {/* Nombre del cultivo debajo de la prioridad */}
              {alert.crop && (
                <View style={styles.cropContainer}>
                  <Text style={styles.cropLabel}>🌱 Cultivo:</Text>
                  <Text style={styles.cropName}>{alert.crop}</Text>
                </View>
              )}

              {/* Mensaje principal */}
              <View style={styles.alertContent}>
                <Text style={styles.alertMessage}>{alert.message}</Text>
              </View>

              {/* Acciones recomendadas */}
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

              {/* Fecha */}
              <View style={styles.alertFooter}>
                <Text style={styles.alertDate}>
                  📅 {new Date(alert.date).toLocaleString('es-MX')}
                </Text>
              </View>

              {/* Indicador de no leído */}
              {!alert.read && <View style={styles.unreadIndicator} />}
            </View>
          ))
        )}
      </View>

      {/* 🔹 Información adicional - Mismo estilo que Home Farmer */}
      <View style={styles.helpSection}>
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>💡 Información sobre Recomendaciones</Text>
          <View style={styles.helpList}>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Las recomendaciones son enviadas por científicos agrícolas</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Marca como leída cuando hayas revisado una recomendación</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Las recomendaciones urgentes tienen prioridad alta</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpIcon}>•</Text>
              <Text style={styles.helpText}>Puedes eliminar recomendaciones que ya no necesites</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 🔽 ESPACIO EN BLANCO PARA SCROLL ADICIONAL */}
      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

// Los estilos permanecen exactamente iguales...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 60,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  // 🔹 HEADER - Mismo estilo que Home Farmer
  header: {
    backgroundColor: '#2e7d32',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'white',
    textAlign: 'center',
    opacity: 0.9,
  },
  // 🔹 INFORMACIÓN DE CONEXIÓN - Mismo estilo que Home Farmer
  connectionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusOnline: {
    backgroundColor: '#4caf50',
  },
  statusOffline: {
    backgroundColor: '#f44336',
  },
  statusText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  unsyncedText: {
    fontSize: 12,
    color: '#ff9800',
    fontWeight: '500',
  },
  // 🔹 TARJETAS PRINCIPALES - Mismo estilo que Home Farmer
  mainCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 8,
  },
  cardIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  cardTitleText: {
    flex: 1,
  },
  cardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  cardDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  // 🔹 SECCIONES
  actionsSection: {
    marginBottom: 16,
  },
  alertsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  // 🔹 ACCIONES RÁPIDAS
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionTextContainer: {
    alignItems: 'center',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  // 🔹 TARJETAS DE ALERTA
  alertCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  unreadAlert: {
    backgroundColor: '#f8f9fa',
  },
  alertActions: {
    flexDirection: 'row',
    gap: 8,
  },
  alertMeta: {
    marginBottom: 8,
  },
  metaBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  metaText: {
    fontSize: 12,
    color: 'white',
    fontWeight: 'bold',
  },
  // 🔹 CONTENEDOR DEL CULTIVO (NUEVO)
  cropContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 8,
  },
  cropLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginRight: 8,
  },
  cropName: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '600',
  },
  alertContent: {
    marginBottom: 12,
  },
  alertMessage: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  actionsList: {
    backgroundColor: '#fff3e0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  actionsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e65100',
    marginBottom: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  actionBullet: {
    color: '#e65100',
    marginRight: 6,
    fontSize: 14,
  },
  actionText: {
    fontSize: 14,
    color: '#e65100',
    flex: 1,
    lineHeight: 18,
  },
  alertFooter: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
  },
  alertDate: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  unreadIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    backgroundColor: '#2e7d32',
    borderRadius: 4,
  },
  // 🔹 ESTADOS DE CARGA Y VACÍO
  emptyCard: {
    backgroundColor: 'white',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 12,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // 🔹 SECCIÓN DE AYUDA
  helpSection: {
    marginBottom: 16,
  },
  helpCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  helpList: {
    gap: 8,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  helpIcon: {
    marginRight: 8,
    fontSize: 14,
    color: '#666',
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20,
  },
  // 🔹 ESPACIO AL FINAL
  bottomSpacing: {
    height: 40,
  },
});