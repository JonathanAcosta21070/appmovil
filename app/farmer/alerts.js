// app/farmer/alerts.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const alertsLocal = await AsyncStorage.getItem('farmerAlerts');
      if (alertsLocal) {
        setAlerts(JSON.parse(alertsLocal));
      } else {
        // Datos de ejemplo
        const sampleAlerts = [
          {
            id: 1,
            title: 'Watering Recommendation',
            message: 'Based on soil moisture data, consider increasing watering frequency by 20% for the next week.',
            type: 'warning',
            date: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            read: false,
            from: 'Agricultural Technician'
          },
          {
            id: 2,
            title: 'Fertilization Schedule',
            message: 'Optimal time for organic fertilization. Recommend using compost tea for better nutrient absorption.',
            type: 'info',
            date: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
            read: true,
            from: 'Dr. Rodriguez'
          }
        ];
        setAlerts(sampleAlerts);
        await AsyncStorage.setItem('farmerAlerts', JSON.stringify(sampleAlerts));
      }
    } catch (error) {
      console.log('Error loading alerts:', error);
    }
  };

  const markAsRead = async (alertId) => {
    const updatedAlerts = alerts.map(alert => 
      alert.id === alertId ? { ...alert, read: true } : alert
    );
    setAlerts(updatedAlerts);
    await AsyncStorage.setItem('farmerAlerts', JSON.stringify(updatedAlerts));
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

  const getAlertColor = (type) => {
    switch (type) {
      case 'warning': return '#ff9800';
      case 'info': return '#2196f3';
      case 'success': return '#4caf50';
      case 'error': return '#f44336';
      default: return '#666';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔔 Recommendations</Text>
      <Text style={styles.subtitle}>Messages from agricultural technicians</Text>

      {alerts.length > 0 ? (
        alerts.map((alert) => (
          <TouchableOpacity
            key={alert.id}
            style={[
              styles.alertCard,
              !alert.read && styles.unreadAlert,
              { borderLeftColor: getAlertColor(alert.type) }
            ]}
            onPress={() => markAsRead(alert.id)}
          >
            <View style={styles.alertHeader}>
              <View style={styles.alertTitleContainer}>
                <Text style={styles.alertIcon}>{getAlertIcon(alert.type)}</Text>
                <View>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertFrom}>From: {alert.from}</Text>
                </View>
              </View>
              {!alert.read && <View style={styles.unreadDot}></View>}
            </View>
            
            <Text style={styles.alertMessage}>{alert.message}</Text>
            
            <View style={styles.alertFooter}>
              <Text style={styles.alertDate}>
                {new Date(alert.date).toLocaleDateString()} at{' '}
                {new Date(alert.date).toLocaleTimeString()}
              </Text>
              <Text style={[styles.alertType, { color: getAlertColor(alert.type) }]}>
                {alert.type.toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No recommendations</Text>
          <Text style={styles.emptySubtext}>
            You'll see messages from agricultural technicians here
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#2e7d32',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  alertCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadAlert: {
    backgroundColor: '#f8f9fa',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  alertTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  alertIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  alertFrom: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    backgroundColor: '#2e7d32',
    borderRadius: 4,
  },
  alertMessage: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 12,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertDate: {
    fontSize: 12,
    color: '#999',
  },
  alertType: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});