import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  TextInput
} from 'react-native';
import { router } from 'expo-router';

export default function SensorConnection() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [esp32IP, setEsp32IP] = useState('192.168.68.122'); // IP por defecto
  const [soilMoisture, setSoilMoisture] = useState(0);

  // ✅ FUNCIÓN PRINCIPAL CON XMLHttpRequest
  const fetchSensorData = () => {
    return new Promise((resolve, reject) => {
      if (!esp32IP || esp32IP === '0.0.0.0') {
        reject(new Error('IP no válida'));
        return;
      }

      console.log(`📡 Conectando via XMLHttpRequest: http://${esp32IP}/sensor`);
      
      const xhr = new XMLHttpRequest();
      xhr.timeout = 10000; // 10 segundos
      xhr.open('GET', `http://${esp32IP}/sensor`, true);
      
      xhr.onload = function() {
        console.log('✅ XMLHttpRequest exitoso. Status:', xhr.status);
        
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            console.log('📊 Datos recibidos:', data);
            
            setSoilMoisture(data.moisture || 0);
            setLastUpdate(new Date());
            resolve(data);
          } catch (error) {
            console.error('❌ Error parseando JSON:', error);
            reject(new Error('El ESP32 respondió pero con formato incorrecto'));
          }
        } else {
          reject(new Error(`Error HTTP: ${xhr.status}`));
        }
      };
      
      xhr.onerror = function() {
        console.log('❌ Error XMLHttpRequest - No se pudo conectar');
        reject(new Error('No se pudo conectar al ESP32 - Error de red'));
      };
      
      xhr.ontimeout = function() {
        console.log('⏰ Timeout XMLHttpRequest');
        reject(new Error('El ESP32 no respondió - Timeout después de 10 segundos'));
      };
      
      xhr.send();
    });
  };

  const connectToSensor = async () => {
    if (!esp32IP || esp32IP === '0.0.0.0') {
      Alert.alert('❌ IP Inválida', 'Por favor ingresa la IP de tu ESP32\n\n💡 La IP aparece en el monitor serie del Arduino IDE');
      return;
    }

    setIsConnecting(true);
    setConnectionStatus('connecting');

    try {
      await fetchSensorData();
      setConnectionStatus('connected');
      Alert.alert('✅ Conectado', 'Sensor de humedad conectado correctamente');
      
      // Iniciar actualización automática
      startAutoUpdate();
      
    } catch (error) {
      console.error('Error conectando al sensor:', error);
      setConnectionStatus('error');
      Alert.alert(
        '❌ Error de Conexión', 
        `No se pudo conectar con el ESP32 en la IP: ${esp32IP}\n\nVerifica:\n• ESP32 encendido\n• Misma red WiFi\n• IP correcta\n\nError: ${error.message}`
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const startAutoUpdate = () => {
    // Actualizar cada 30 segundos cuando esté conectado
    const interval = setInterval(async () => {
      if (connectionStatus === 'connected') {
        try {
          await fetchSensorData();
          console.log('🔄 Actualización automática exitosa');
        } catch (error) {
          console.error('Error en actualización automática:', error);
          // Si falla, desconectar
          setConnectionStatus('error');
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  };

  const disconnectSensor = () => {
    setConnectionStatus('disconnected');
    setSoilMoisture(0);
    Alert.alert('🔌 Desconectado', 'Sensor desconectado');
  };

  const testConnection = async () => {
    if (!esp32IP || esp32IP === '0.0.0.0') {
      Alert.alert('❌ IP Inválida', 'Por favor ingresa la IP de tu ESP32\n\n💡 La IP aparece en el monitor serie del Arduino IDE');
      return;
    }

    try {
      setIsConnecting(true);
      const data = await fetchSensorData();
      Alert.alert(
        '✅ Conexión Exitosa', 
        `Datos del sensor de humedad:\n\n💧 Humedad del suelo: ${data.moisture}%`
      );
    } catch (error) {
      Alert.alert('❌ Error', `No se pudo conectar con el ESP32:\n${error.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const getStatusInfo = () => {
    switch (connectionStatus) {
      case 'disconnected':
        return { text: 'Desconectado', color: '#f44336', icon: '🔴' };
      case 'connecting':
        return { text: 'Conectando...', color: '#ff9800', icon: '🟡' };
      case 'connected':
        return { text: 'Conectado', color: '#4caf50', icon: '🟢' };
      case 'error':
        return { text: 'Error', color: '#f44336', icon: '❌' };
      default:
        return { text: 'Desconectado', color: '#f44336', icon: '🔴' };
    }
  };

  const getMoistureStatus = (moisture) => {
    if (moisture === 0) return { 
      text: 'Sin datos', 
      color: '#666', 
      advice: 'Conecta el sensor de humedad',
      description: 'El sensor no está enviando datos'
    };
    if (moisture < 20) return { 
      text: 'MUY SECO', 
      color: '#d32f2f', 
      advice: '🌵 NECESITA RIEGO URGENTE',
      description: 'La tierra está muy seca'
    };
    if (moisture < 30) return { 
      text: 'Seco', 
      color: '#f57c00', 
      advice: '💧 Se recomienda regar pronto',
      description: 'La tierra está seca'
    };
    if (moisture < 60) return { 
      text: 'ÓPTIMO', 
      color: '#4caf50', 
      advice: '✅ Nivel de humedad perfecto',
      description: 'La tierra tiene humedad ideal'
    };
    if (moisture < 80) return { 
      text: 'Húmedo', 
      color: '#1976d2', 
      advice: '⏳ No se necesita riego',
      description: 'La tierra está húmeda'
    };
    return { 
      text: 'MUY HÚMEDO', 
      color: '#303f9f', 
      advice: '🚫 EXCESO DE AGUA - No regar',
      description: 'La tierra está saturada de agua'
    };
  };

  const statusInfo = getStatusInfo();
  const moistureInfo = getMoistureStatus(soilMoisture);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>💧 Sensor de Humedad</Text>
        <Text style={styles.subtitle}>
          Monitorea la humedad de tus plantas en tiempo real
        </Text>
      </View>

      {/* Configuración de IP */}
      <View style={styles.configCard}>
        <Text style={styles.configTitle}>🔧 Configuración ESP32</Text>
        <Text style={styles.configLabel}>IP del ESP32:</Text>
        <TextInput
          style={styles.input}
          value={esp32IP}
          onChangeText={setEsp32IP}
          placeholder="192.168.68.115"
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.helpText}>
          💡 IP actual del ESP32: 192.168.68.115
        </Text>
        <TouchableOpacity 
          style={[styles.testButton, (!esp32IP || esp32IP === '0.0.0.0') && styles.disabledButton]}
          onPress={testConnection}
          disabled={isConnecting || !esp32IP || esp32IP === '0.0.0.0'}
        >
          {isConnecting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.testButtonText}>
              {esp32IP ? '🧪 Probar Conexión' : '📝 Ingresa IP primero'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Estado de Conexión */}
      <View style={styles.connectionCard}>
        <View style={styles.connectionHeader}>
          <Text style={styles.connectionTitle}>Estado del Sensor</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
            <Text style={styles.statusText}>
              {statusInfo.icon} {statusInfo.text}
            </Text>
          </View>
        </View>

        <View style={styles.connectionInfo}>
          <Text style={styles.infoText}>
            🔌 <Text style={styles.infoBold}>Dispositivo:</Text> ESP32 + Sensor Humedad
          </Text>
          <Text style={styles.infoText}>
            📍 <Text style={styles.infoBold}>IP:</Text> {esp32IP || 'No configurada'}
          </Text>
          <Text style={styles.infoText}>
            🌱 <Text style={styles.infoBold}>Sensor:</Text> Humedad de suelo (2 patas)
          </Text>
          <Text style={styles.infoText}>
            🔄 <Text style={styles.infoBold}>Método:</Text> XMLHttpRequest
          </Text>
          {lastUpdate && (
            <Text style={styles.infoText}>
              ⏰ <Text style={styles.infoBold}>Última lectura:</Text> {lastUpdate.toLocaleTimeString()}
            </Text>
          )}
        </View>

        {connectionStatus === 'disconnected' && (
          <TouchableOpacity 
            style={[styles.button, styles.connectButton, (!esp32IP || esp32IP === '0.0.0.0') && styles.disabledButton]}
            onPress={connectToSensor}
            disabled={isConnecting || !esp32IP || esp32IP === '0.0.0.0'}
          >
            {isConnecting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>
                {esp32IP ? '🔗 Conectar Sensor' : '📝 Ingresa IP primero'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {connectionStatus === 'connected' && (
          <TouchableOpacity 
            style={[styles.button, styles.disconnectButton]}
            onPress={disconnectSensor}
          >
            <Text style={styles.buttonText}>🔌 Desconectar</Text>
          </TouchableOpacity>
        )}

        {connectionStatus === 'error' && (
          <TouchableOpacity 
            style={[styles.button, styles.retryButton]}
            onPress={connectToSensor}
          >
            <Text style={styles.buttonText}>🔄 Reintentar Conexión</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Datos en Tiempo Real */}
      {connectionStatus === 'connected' && (
        <View style={styles.dataCard}>
          <Text style={styles.dataTitle}>📊 Datos Reales del Sensor</Text>
          
          <View style={styles.moistureContainer}>
            <Text style={styles.moistureValue}>{soilMoisture}%</Text>
            <View style={[styles.moistureBar, { width: `${soilMoisture}%` }]} />
          </View>

          <View style={styles.statusContainer}>
            <Text style={[styles.statusTextLarge, { color: moistureInfo.color }]}>
              {moistureInfo.text}
            </Text>
            <Text style={styles.statusDescription}>
              {moistureInfo.description}
            </Text>
          </View>

          <View style={[styles.adviceCard, { backgroundColor: moistureInfo.color + '20' }]}>
            <Text style={[styles.adviceTitle, { color: moistureInfo.color }]}>
              💡 Recomendación
            </Text>
            <Text style={[styles.adviceText, { color: moistureInfo.color }]}>
              {moistureInfo.advice}
            </Text>
          </View>

          <View style={styles.updateInfo}>
            <Text style={styles.updateText}>
              🔄 Actualización automática cada 30 segundos
            </Text>
            {lastUpdate && (
              <Text style={styles.updateText}>
                Última lectura: {lastUpdate.toLocaleTimeString()}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Instrucciones */}
      <View style={styles.instructionsCard}>
        <Text style={styles.instructionsTitle}>🚀 Cómo conectar</Text>
        <Text style={styles.instructionStep}>1. ESP32 ya está en IP: 192.168.68.115</Text>
        <Text style={styles.instructionStep}>2. Toca "Probar Conexión" para verificar</Text>
        <Text style={styles.instructionStep}>3. Si funciona, toca "Conectar Sensor"</Text>
        <Text style={styles.instructionStep}>4. ¡Los datos aparecerán automáticamente!</Text>
      </View>

      {/* Botón de Regreso */}
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>← Volver al Panel</Text>
      </TouchableOpacity>

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2e7d32',
    padding: 20,
    paddingTop: 50,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
    textAlign: 'center',
  },
  configCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  configTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  configLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  testButton: {
    backgroundColor: '#2196f3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#9e9e9e',
    opacity: 0.6,
  },
  testButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  connectionCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  connectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  connectionInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  infoBold: {
    fontWeight: '600',
    color: '#333',
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectButton: {
    backgroundColor: '#4caf50',
  },
  disconnectButton: {
    backgroundColor: '#f44336',
  },
  retryButton: {
    backgroundColor: '#ff9800',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  dataCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dataTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  moistureContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  moistureValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 10,
  },
  moistureBar: {
    height: 20,
    backgroundColor: '#4caf50',
    borderRadius: 10,
    maxWidth: '100%',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTextLarge: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  adviceCard: {
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  adviceTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  adviceText: {
    fontSize: 13,
    fontWeight: '500',
  },
  updateInfo: {
    marginTop: 12,
    alignItems: 'center',
  },
  updateText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  instructionsCard: {
    backgroundColor: '#e8f5e8',
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 12,
  },
  instructionStep: {
    fontSize: 14,
    color: '#2e7d32',
    marginBottom: 8,
    lineHeight: 20,
  },
  backButton: {
    backgroundColor: '#666',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  bottomSpace: {
    height: 40,
  },
});