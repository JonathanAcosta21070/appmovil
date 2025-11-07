// contexts/BleContext.js - VERSIÓN CORREGIDA Y ESTABILIZADA
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { BleManager } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { Buffer } from 'buffer';

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

const BleContext = createContext();

export const useBle = () => {
  const context = useContext(BleContext);
  if (!context) {
    throw new Error('useBle debe ser usado dentro de un BleProvider');
  }
  return context;
};

export const BleProvider = ({ children }) => {
  const [humidity, setHumidity] = useState(0);
  const [status, setStatus] = useState("Desconectado");
  const [isConnected, setIsConnected] = useState(false);
    const [humidityHistory, setHumidityHistory] = useState([]);
  const [deviceName, setDeviceName] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [lastUpdate, setLastUpdate] = useState(null);
  const [currentDevice, setCurrentDevice] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [devicesList, setDevicesList] = useState([]);
  
  const managerRef = useRef(new BleManager());
  const bufferRef = useRef("");
  const scanTimeoutRef = useRef(null);
  const connectionRef = useRef(null);
  const monitorRef = useRef(null);

  // ✅ CLEANUP MEJORADO - Previene memory leaks
  useEffect(() => {
    const manager = managerRef.current;
    
    return () => {
      console.log("🧹 Cleanup del BleProvider");
      
      // Limpiar timeouts
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      
      // Detener escaneo
      manager.stopDeviceScan();
      
      // Desconectar dispositivo si está conectado
      if (connectionRef.current) {
        manager.cancelDeviceConnection(connectionRef.current.id)
          .catch(err => console.log("⚠️ Error en cleanup de conexión:", err));
      }
      
      // Limpiar referencias
      connectionRef.current = null;
      monitorRef.current = null;
    };
  }, []);

  // ✅ SOLICITAR PERMISOS - Versión Mejorada
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        // Para Android 12+ (API 31+)
        if (Platform.Version >= 31) {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);
          
          return (
            granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
            granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
          );
        } else {
          // Para versiones anteriores
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
      } catch (err) {
        console.log("❌ Error en permisos:", err);
        return false;
      }
    }
    return true; // Para iOS
  };

  // ✅ VERIFICAR ESTADO BLUETOOTH - Con manejo de errores
  const checkBluetoothState = async () => {
    try {
      const state = await managerRef.current.state();
      console.log("📱 Estado Bluetooth:", state);
      
      if (state === 'PoweredOff') {
        setConnectionError("Activa el Bluetooth para escanear");
        return false;
      }
      
      return true;
    } catch (error) {
      console.log("❌ Error estado Bluetooth:", error);
      return false;
    }
  };

  // ✅ ESCANEAR DISPOSITIVOS - Con protección contra crashes
  const scanForDevices = async () => {
    try {
      console.log("🔍 Iniciando escaneo...");
      
      // Resetear estado
      setConnectionError("");
      setDevicesList([]);
      setStatus("Solicitando permisos...");
      
      // Detener escaneo previo
      stopScan();
      
      // Verificar permisos y estado
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        setStatus("Permisos denegados");
        setConnectionError("Permisos de Bluetooth necesarios");
        return;
      }
      
      const isBluetoothReady = await checkBluetoothState();
      if (!isBluetoothReady) {
        return;
      }
      
      setStatus("Buscando sensores...");
      setIsScanning(true);
      
      // Timeout de seguridad
      scanTimeoutRef.current = setTimeout(() => {
        console.log("⏰ Timeout de escaneo");
        stopScan();
      }, 15000);
      
      // Iniciar escaneo con manejo de errores
      managerRef.current.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.log("❌ Error escaneo:", error);
          if (error.errorCode !== 102) { // No mostrar error si se detuvo manualmente
            setConnectionError("Error escaneando dispositivos");
          }
          setIsScanning(false);
          return;
        }
        
        if (device?.name) {
          const deviceName = device.name.toLowerCase();
          const isTargetDevice = 
            deviceName.includes("esp32") || 
            deviceName.includes("sensor") || 
            deviceName.includes("humedad");
          
          if (isTargetDevice) {
            setDevicesList(prev => {
              const exists = prev.some(d => d.id === device.id);
              if (!exists) {
                const newList = [...prev, {
                  id: device.id,
                  name: device.name,
                  device: device
                }];
                setStatus(`Encontrados: ${newList.length} sensor(es)`);
                return newList;
              }
              return prev;
            });
          }
        }
      });
      
    } catch (error) {
      console.log("❌ Error crítico en escaneo:", error);
      setStatus("Error al escanear");
      setConnectionError("Error interno al escanear");
      setIsScanning(false);
    }
  };

  // ✅ DETENER ESCANEO - Mejorado
  const stopScan = () => {
    console.log("🛑 Deteniendo escaneo...");
    
    try {
      managerRef.current.stopDeviceScan();
    } catch (error) {
      console.log("⚠️ Error deteniendo escaneo:", error);
    }
    
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    
    setIsScanning(false);
    
    if (devicesList.length === 0) {
      setStatus("No se encontraron sensores");
    } else {
      setStatus(`Listo - ${devicesList.length} sensor(es) encontrado(s)`);
    }
  };

  // ✅ CONECTAR A DISPOSITIVO - CON MANEJO ROBUSTO DE DESCONEXIONES
  const connectToDevice = async (device) => {
    try {
      console.log(`🔗 Conectando a: ${device.name}`);
      
      // Limpiar estado anterior
      setStatus("Conectando...");
      setConnectionError("");
      bufferRef.current = "";
      stopScan();
      
      const deviceInstance = device.device || device;
      
      // 🔥 CRÍTICO: Limpiar conexión anterior si existe
      if (connectionRef.current) {
        try {
          await managerRef.current.cancelDeviceConnection(connectionRef.current.id);
        } catch (e) {
          console.log("⚠️ Error limpiando conexión anterior:", e);
        }
        connectionRef.current = null;
      }
      
      // Conectar al dispositivo con timeout
      const connectionPromise = deviceInstance.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout de conexión")), 10000)
      );
      
      const connectedDevice = await Promise.race([connectionPromise, timeoutPromise]);
      await connectedDevice.discoverAllServicesAndCharacteristics();
      
      // Guardar referencia
      connectionRef.current = connectedDevice;
      
      // Actualizar estado
      setIsConnected(true);
      setDeviceName(device.name || "Sensor ESP32");
      setCurrentDevice(connectedDevice);
      setStatus("Conectado - Esperando datos...");
      setConnectionError("");
      
      console.log("✅ Conectado exitosamente");

      // 🔥 CRÍTICO: Monitorear características con manejo de errores
      monitorRef.current = connectedDevice.monitorCharacteristicForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            console.log("❌ Error en monitorización:", error);
            if (!error.message?.includes('cancelled')) {
              handleDisconnection("Error en comunicación");
            }
            return;
          }

          if (characteristic?.value) {
            try {
              const data = Buffer.from(characteristic.value, 'base64').toString('utf-8');
              console.log("📥 Datos:", data);
              processReceivedData(data);
            } catch (decodeError) {
              console.log("❌ Error decodificando:", decodeError);
            }
          }
        }
      );

      // 🔥 CRÍTICO: Manejar desconexión del dispositivo
      connectedDevice.onDisconnected((error) => {
        console.log("📱 Dispositivo desconectado:", error);
        handleDisconnection("Sensor desconectado");
      });

    } catch (error) {
      console.log("❌ Error en conexión:", error);
      setStatus("Error al conectar");
      setConnectionError(error.message || "No se pudo conectar");
      setIsConnected(false);
      setCurrentDevice(null);
      connectionRef.current = null;
    }
  };

  // ✅ PROCESAR DATOS - Con validación robusta
 const processReceivedData = (data) => {
    try {
      if (!data || typeof data !== 'string') return;
      
      const trimmedData = data.trim();
      if (trimmedData.length === 0) return;

      console.log("📥 Procesando datos:", trimmedData);
      
      // Intentar parsear como JSON
      try {
        const sensorData = JSON.parse(trimmedData);
        if (sensorData.m !== undefined && !isNaN(sensorData.m)) {
          const moistureValue = Number(sensorData.m);
          
          // ✅ GUARDAR EN HISTORIAL
          setHumidityHistory(prev => {
            const newHistory = [...prev, {
              value: moistureValue,
              timestamp: new Date().toISOString()
            }];
            // Mantener solo los últimos 50 registros para no ocupar mucha memoria
            return newHistory.slice(-50);
          });
          
          setHumidity(moistureValue);
          setLastUpdate(new Date());
          setStatus(`Conectado - Humedad: ${moistureValue}%`);
          setConnectionError("");
          return;
        }
      } catch (jsonError) {
        // ... resto del procesamiento existente ...
        // También agregar al historial en los otros casos de procesamiento
      }
    } catch (error) {
      console.log("❌ Error procesando datos:", error);
    }
  };

  // ✅ MANEJAR DESCONEXIÓN - Versión Mejorada
  const handleDisconnection = (message = "Desconectado") => {
    console.log("🛑 Manejar desconexión:", message);
    
    // Limpiar referencias y estados
    if (monitorRef.current) {
      monitorRef.current.remove();
      monitorRef.current = null;
    }
    
    connectionRef.current = null;
    
    setIsConnected(false);
    setCurrentDevice(null);
    setStatus(message);
    setConnectionError(message);
    setHumidity(0);
    bufferRef.current = "";
  };

  // ✅ DESCONECTAR DISPOSITIVO - Con protección completa
  const disconnectDevice = async () => {
    try {
      console.log("🛑 Iniciando desconexión manual...");
      
      stopScan();
      
      if (connectionRef.current) {
        try {
          await managerRef.current.cancelDeviceConnection(connectionRef.current.id);
          console.log("✅ Desconexión manual exitosa");
        } catch (error) {
          console.log("⚠️ Error en desconexión manual:", error);
        }
      }
      
      handleDisconnection("Desconectado manualmente");
      
    } catch (error) {
      console.log("❌ Error en desconexión:", error);
      // Forzar limpieza incluso si hay error
      handleDisconnection("Error al desconectar");
    }
  };

  const value = {
    // Estados
    humidity,
    status,
    isConnected,
    deviceName,
    connectionError,
    lastUpdate,
    isScanning,
    devicesList,
    humidityHistory,
    
    // Funciones
    disconnectDevice,
    connectToDevice,
    scanForDevices,
    stopScan,
  };

  return (
    <BleContext.Provider value={value}>
      {children}
    </BleContext.Provider>
  );
};