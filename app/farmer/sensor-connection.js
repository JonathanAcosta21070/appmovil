// app/farmer/sensor-connection.js - VERSIÓN CON ESTADO PERSISTENTE
import React from "react";
import { 
  View, 
  Text, 
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { useBle } from '../../contexts/BleContext';

export default function SensorConnectionScreen() {
  const {
    humidity,
    status,
    isConnected,
    deviceName,
    connectionError,
    lastUpdate,
    isScanning,
    devicesList,
    disconnectDevice,
    connectToDevice,
    scanForDevices,
    stopScan,
  } = useBle();

  // ✅ FUNCIÓN LOCAL: getHumidityStatus
  const getHumidityStatus = (humidityValue) => {
    if (humidityValue === null) return { level: "Sin datos", color: "#666", icon: "❓", advice: "Conecta el sensor para ver la humedad" };
    if (humidityValue < 30) return { level: "Baja", color: "#f44336", icon: "⚠️", advice: "Necesita riego urgente" };
    if (humidityValue < 60) return { level: "Óptima", color: "#4caf50", icon: "✅", advice: "Humedad ideal" };
    return { level: "Alta", color: "#2196f3", icon: "💧", advice: "Suelo húmedo" };
  };

  const humidityStatus = getHumidityStatus(humidity);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header Mejorado */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>🌱 Monitoreo de Humedad</Text>
          <Text style={styles.subtitle}>
            {isConnected ? "Sensor conectado - Datos en tiempo real" : "Conecta tu sensor ESP32 para monitorear la humedad"}
          </Text>
        </View>
        <View style={styles.headerWave} />
      </View>

      {/* Tarjeta de Estado de Conexión Mejorada */}
      <View style={styles.connectionCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.connectionTitle}>📡 Estado de Conexión</Text>
          <View style={[styles.connectionBadge, 
            isConnected ? styles.connectedBadge : 
            isScanning ? styles.scanningBadge : styles.disconnectedBadge
          ]}>
            <Text style={styles.badgeText}>
              {isConnected ? 'Conectado' : isScanning ? 'Escaneando' : 'Desconectado'}
            </Text>
          </View>
        </View>
        
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <View style={[styles.statusIndicator, { 
              backgroundColor: isConnected ? '#4caf50' : isScanning ? '#ff9800' : '#f44336' 
            }]} />
            <Text style={styles.statusText}>
              {isConnected ? `✅ ${status}` : isScanning ? `🔍 ${status}` : `🔌 ${status}`}
            </Text>
          </View>

          {deviceName && isConnected && (
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceLabel}>Dispositivo conectado:</Text>
              <Text style={styles.deviceName}>📱 {deviceName}</Text>
            </View>
          )}

          {connectionError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{connectionError}</Text>
            </View>
          ) : null}
        </View>

        {/* Botones de Control Mejorados */}
        <View style={styles.buttonContainer}>
          {isConnected ? (
            <TouchableOpacity 
              style={[styles.button, styles.disconnectButton]}
              onPress={disconnectDevice}
            >
              <View style={styles.buttonContent}>
                <Text style={styles.buttonIcon}>🔴</Text>
                <Text style={styles.buttonText}>Desconectar Sensor</Text>
              </View>
            </TouchableOpacity>
          ) : isScanning ? (
            <View style={styles.scanButtonsContainer}>
              <TouchableOpacity 
                style={[styles.button, styles.stopButton]}
                onPress={stopScan}
              >
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonIcon}>⏹️</Text>
                  <Text style={styles.buttonText}>Detener Escaneo</Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.button, styles.connectButton]}
              onPress={scanForDevices}
            >
              <View style={styles.buttonContent}>
                <Text style={styles.buttonIcon}>🔍</Text>
                <Text style={styles.buttonText}>Buscar Sensores</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Lista de Dispositivos Encontrados */}
        {devicesList.length > 0 && !isConnected && (
          <View style={styles.devicesListContainer}>
            <Text style={styles.devicesListTitle}>📋 Sensores Disponibles:</Text>
            {devicesList.map((device) => (
              <TouchableOpacity
                key={device.id}
                style={styles.deviceItem}
                onPress={() => connectToDevice(device.device)}
              >
                <View style={styles.deviceItemContent}>
                  <Text style={styles.deviceItemIcon}>📱</Text>
                  <View style={styles.deviceItemInfo}>
                    <Text style={styles.deviceItemName}>{device.name}</Text>
                    <Text style={styles.deviceItemId}>{device.id}</Text>
                  </View>
                  <Text style={styles.deviceItemConnect}>Conectar →</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Tarjeta de Humedad del Suelo Mejorada */}
      <View style={styles.dataCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.dataTitle}>💧 Humedad del Suelo</Text>
          <View style={[styles.humidityBadge, { backgroundColor: humidityStatus.color }]}>
            <Text style={styles.badgeText}>{humidityStatus.level}</Text>
          </View>
        </View>
        
        <View style={styles.humidityMainContainer}>
          <View style={styles.humidityValueContainer}>
            <Text style={[styles.humidityValue, { color: humidityStatus.color }]}>
              {humidity !== null ? `${humidity}%` : '--%'}
            </Text>
            <Text style={[styles.humidityStatus, { color: humidityStatus.color }]}>
              {humidityStatus.icon} {humidityStatus.level}
            </Text>
          </View>
          
          {isConnected && (
            <View style={styles.adviceContainer}>
              <Text style={styles.adviceIcon}>💡</Text>
              <Text style={styles.adviceText}>{humidityStatus.advice}</Text>
            </View>
          )}
          
          {/* Barra de humedad visual mejorada */}
          <View style={styles.humidityBarContainer}>
            <View style={styles.humidityBar}>
              <View 
                style={[
                  styles.humidityFill,
                  { 
                    width: `${humidity !== null ? Math.min(humidity, 100) : 0}%`,
                    backgroundColor: humidityStatus.color
                  }
                ]} 
              />
            </View>
            <Text style={styles.humidityPercentage}>
              {humidity !== null ? `${humidity}%` : '0%'}
            </Text>
          </View>
          
          {/* Indicadores de niveles mejorados */}
          <View style={styles.levelIndicators}>
            <View style={styles.levelItem}>
              <View style={[styles.levelDot, { backgroundColor: '#f44336' }]} />
              <Text style={[styles.levelText, humidity !== null && humidity < 30 && styles.levelActive]}>
                Seco
              </Text>
            </View>
            <View style={styles.levelItem}>
              <View style={[styles.levelDot, { backgroundColor: '#4caf50' }]} />
              <Text style={[styles.levelText, humidity !== null && humidity >= 30 && humidity < 60 && styles.levelActive]}>
                Óptimo
              </Text>
            </View>
            <View style={styles.levelItem}>
              <View style={[styles.levelDot, { backgroundColor: '#2196f3' }]} />
              <Text style={[styles.levelText, humidity !== null && humidity >= 60 && styles.levelActive]}>
                Húmedo
              </Text>
            </View>
          </View>
        </View>

        {lastUpdate && isConnected && (
          <View style={styles.updateContainer}>
            <Text style={styles.updateIcon}>🕒</Text>
            <Text style={styles.lastUpdate}>
              Actualizado: {lastUpdate.toLocaleTimeString('es-MX')}
            </Text>
          </View>
        )}
        
        {isConnected && humidity === null && (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingIcon}>⏳</Text>
            <Text style={styles.waitingText}>Esperando datos del sensor...</Text>
          </View>
        )}

        {!isConnected && (
          <View style={styles.notConnectedContainer}>
            <Text style={styles.notConnectedIcon}>🔌</Text>
            <Text style={styles.notConnectedText}>
              Conecta un sensor para ver los datos de humedad
            </Text>
          </View>
        )}
      </View>

      {/* Información de ayuda */}
      <View style={styles.helpCard}>
        <Text style={styles.helpTitle}>📋 Estado Persistente</Text>
        <View style={styles.helpList}>
          <View style={styles.helpItem}>
            <Text style={styles.helpIcon}>✅</Text>
            <Text style={styles.helpText}>La conexión se mantiene al salir de la pantalla</Text>
          </View>
          <View style={styles.helpItem}>
            <Text style={styles.helpIcon}>📱</Text>
            <Text style={styles.helpText}>Los datos siguen llegando en segundo plano</Text>
          </View>
          <View style={styles.helpItem}>
            <Text style={styles.helpIcon}>🔄</Text>
            <Text style={styles.helpText}>Al volver, verás los datos actualizados</Text>
          </View>
          <View style={styles.helpItem}>
            <Text style={styles.helpIcon}>⏹️</Text>
            <Text style={styles.helpText}>Solo se desconecta cuando tú lo decides</Text>
          </View>
        </View>
      </View>

      {/* Botón para volver mejorado - SIN DESCONEXIÓN AUTOMÁTICA */}
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <View style={styles.backButtonContent}>
          <Text style={styles.backButtonIcon}>←</Text>
          <Text style={styles.backButtonText}>Volver al Panel Principal</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

// Tus estilos permanecen exactamente iguales...
const styles = StyleSheet.create({
  // ... (todos tus estilos existentes se mantienen igual)
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    paddingBottom: 30,
  },
  header: {
    backgroundColor: '#2e7d32',
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  headerContent: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  headerWave: {
    height: 20,
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 20,
  },
  connectionCard: {
    backgroundColor: 'white',
    margin: 20,
    marginTop: 10,
    padding: 25,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  connectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a237e',
  },
  connectionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  connectedBadge: {
    backgroundColor: '#e8f5e8',
  },
  scanningBadge: {
    backgroundColor: '#fff3e0',
  },
  disconnectedBadge: {
    backgroundColor: '#f3f4f6',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  statusContainer: {
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
  },
  statusText: {
    fontSize: 16,
    color: '#37474f',
    flex: 1,
    fontWeight: '500',
  },
  deviceInfo: {
    backgroundColor: '#f3f4f6',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  deviceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
  },
  errorIcon: {
    marginRight: 10,
    fontSize: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  buttonContainer: {
    marginTop: 10,
  },
  scanButtonsContainer: {
    gap: 10,
  },
  button: {
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connectButton: {
    backgroundColor: '#2563eb',
  },
  disconnectButton: {
    backgroundColor: '#dc2626',
  },
  stopButton: {
    backgroundColor: '#f59e0b',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Lista de dispositivos
  devicesListContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  devicesListTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 12,
  },
  deviceItem: {
    backgroundColor: '#f8fafc',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  deviceItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceItemIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  deviceItemInfo: {
    flex: 1,
  },
  deviceItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  deviceItemId: {
    fontSize: 12,
    color: '#6b7280',
  },
  deviceItemConnect: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  dataCard: {
    backgroundColor: 'white',
    margin: 20,
    marginTop: 10,
    padding: 25,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  dataTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a237e',
  },
  humidityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  humidityMainContainer: {
    alignItems: 'center',
  },
  humidityValueContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  humidityValue: {
    fontSize: 52,
    fontWeight: 'bold',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  humidityStatus: {
    fontSize: 18,
    fontWeight: '600',
  },
  adviceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 25,
    width: '100%',
  },
  adviceIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  adviceText: {
    fontSize: 15,
    color: '#0369a1',
    fontWeight: '500',
    flex: 1,
    fontStyle: 'italic',
  },
  notConnectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    padding: 20,
    borderRadius: 12,
    marginTop: 10,
  },
  notConnectedIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  notConnectedText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
    flex: 1,
  },
  humidityBarContainer: {
    width: '100%',
    marginBottom: 20,
  },
  humidityBar: {
    width: '100%',
    height: 16,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  humidityFill: {
    height: '100%',
    borderRadius: 8,
    transition: 'width 0.5s ease-in-out',
  },
  humidityPercentage: {
    textAlign: 'center',
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  levelIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  levelItem: {
    alignItems: 'center',
    flex: 1,
  },
  levelDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 5,
  },
  levelText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
    textAlign: 'center',
  },
  levelActive: {
    color: '#1f2937',
    fontWeight: 'bold',
  },
  updateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  updateIcon: {
    marginRight: 8,
  },
  lastUpdate: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    padding: 12,
    backgroundColor: '#fffbeb',
    borderRadius: 8,
  },
  waitingIcon: {
    marginRight: 8,
  },
  waitingText: {
    fontSize: 14,
    color: '#d97706',
    fontWeight: '500',
  },
  helpCard: {
    backgroundColor: 'white',
    margin: 20,
    marginTop: 10,
    padding: 25,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a237e',
    marginBottom: 15,
  },
  helpList: {
    gap: 12,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helpIcon: {
    fontSize: 16,
    marginRight: 12,
    width: 24,
  },
  helpText: {
    fontSize: 14,
    color: '#4b5563',
    flex: 1,
  },
  backButton: {
    backgroundColor: '#374151',
    margin: 20,
    marginTop: 10,
    padding: 18,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonIcon: {
    fontSize: 20,
    color: 'white',
    marginRight: 10,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});