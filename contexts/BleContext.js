// contexts/BleContext.js - VERSIÓN MEJORADA
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { BleManager } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
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
  const [humidity, setHumidity] = useState(null);
  const [status, setStatus] = useState("Desconectado");
  const [isConnected, setIsConnected] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [lastUpdate, setLastUpdate] = useState(null);
  const [currentDevice, setCurrentDevice] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [devicesList, setDevicesList] = useState([]);
  
  const managerRef = useRef(new BleManager());
  const bufferRef = useRef("");
  const scanTimeoutRef = useRef(null);

  // ✅ Solicitar permisos BLE para Android
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        
        return (
          granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.log("❌ Error solicitando permisos:", err);
        return false;
      }
    }
    return true; // Para iOS
  };

  // ✅ Verificar estado del Bluetooth
  const checkBluetoothState = async () => {
    try {
      const state = await managerRef.current.state();
      console.log("📱 Estado del Bluetooth:", state);
      
      if (state === 'PoweredOff') {
        setConnectionError("El Bluetooth está apagado. Actívalo para escanear.");
        return false;
      }
      if (state === 'Unauthorized') {
        setConnectionError("Sin permisos de Bluetooth. Verifica los permisos de la app.");
        return false;
      }
      if (state === 'Unsupported') {
        setConnectionError("Bluetooth no soportado en este dispositivo.");
        return false;
      }
      
      return true;
    } catch (error) {
      console.log("❌ Error verificando estado Bluetooth:", error);
      setConnectionError("Error verificando estado del Bluetooth");
      return false;
    }
  };

  // ✅ Escanear dispositivos - VERSIÓN MEJORADA
  const scanForDevices = async () => {
    try {
      console.log("🔍 Iniciando escaneo BLE...");
      
      // Limpiar estado anterior
      setConnectionError("");
      setDevicesList([]);
      setStatus("Solicitando permisos...");
      
      // Solicitar permisos
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        setStatus("Permisos denegados");
        setConnectionError("Se necesitan permisos de Bluetooth y ubicación para escanear");
        setIsScanning(false);
        return;
      }
      
      // Verificar estado del Bluetooth
      const isBluetoothReady = await checkBluetoothState();
      if (!isBluetoothReady) {
        setIsScanning(false);
        return;
      }
      
      setStatus("Buscando sensores ESP32...");
      setIsScanning(true);
      
      // Detener cualquier escaneo previo
      managerRef.current.stopDeviceScan();
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      
      // Iniciar nuevo escaneo
      managerRef.current.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.log("❌ Error en escaneo:", error);
          setStatus("Error de escaneo BLE");
          setConnectionError(`Error: ${error.message || "No se puede escanear dispositivos"}`);
          setIsScanning(false);
          managerRef.current.stopDeviceScan();
          return;
        }
        
        if (device && device.name) {
          console.log(`📱 Dispositivo encontrado: ${device.name} (${device.id})`);
          
          // Filtrar dispositivos ESP32 o sensores de humedad
          const deviceName = device.name || "";
          const isTargetDevice = 
            deviceName.includes("ESP32") || 
            deviceName.includes("Sensor") || 
            deviceName.includes("Humedad") ||
            deviceName.includes("sensor") ||
            deviceName.includes("esp32");
          
          if (isTargetDevice) {
            setDevicesList(prev => {
              const exists = prev.some(d => d.id === device.id);
              if (!exists) {
                console.log(`✅ Añadiendo dispositivo: ${device.name}`);
                const newList = [...prev, {
                  id: device.id,
                  name: device.name || "Sensor Desconocido",
                  device: device
                }];
                setStatus(`Encontrados ${newList.length} sensor(es)`);
                return newList;
              }
              return prev;
            });
          }
        }
      });
      
      // Detener automáticamente después de 15 segundos
      scanTimeoutRef.current = setTimeout(() => {
        console.log("⏹️ Deteniendo escaneo automático");
        stopScan();
      }, 15000);
      
    } catch (error) {
      console.log("❌ Error iniciando escaneo:", error);
      setStatus("Error al iniciar escaneo");
      setConnectionError(error.message || "Error desconocido");
      setIsScanning(false);
    }
  };

  // ✅ Detener escaneo - VERSIÓN MEJORADA
  const stopScan = () => {
    console.log("🛑 Deteniendo escaneo...");
    
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    
    managerRef.current.stopDeviceScan();
    setIsScanning(false);
    
    if (devicesList.length === 0) {
      setStatus("Escaneo completado - No se encontraron sensores ESP32");
      setConnectionError("No se encontraron sensores ESP32. Asegúrate de que el sensor esté encendido y cerca.");
    } else {
      setStatus(`Escaneo completado - ${devicesList.length} sensor(es) encontrado(s)`);
    }
  };

  // ✅ Conectar a dispositivo - VERSIÓN MEJORADA
  const connectToDevice = async (device) => {
    try {
      console.log(`🔗 Conectando a: ${device.name}`);
      setStatus("Conectando...");
      setConnectionError("");
      bufferRef.current = "";
      
      // Detener escaneo
      stopScan();
      
      const deviceInstance = device.device || device;
      
      // Conectar al dispositivo
      const connectedDevice = await deviceInstance.connect();
      await connectedDevice.discoverAllServicesAndCharacteristics();
      
      setIsConnected(true);
      setDeviceName(device.name || "ESP32-Sensor");
      setCurrentDevice(connectedDevice);
      setStatus("Conectado - Esperando datos...");
      setConnectionError("");

      console.log("✅ Conectado exitosamente, monitoreando características...");

      // Monitorear características para recibir datos
      connectedDevice.monitorCharacteristicForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            console.log("❌ Error en monitorización:", error);
            setConnectionError("Error en comunicación con el sensor");
            setStatus("Error de comunicación");
            return;
          }

          if (characteristic?.value) {
            try {
              const base64Data = characteristic.value;
              const decodedString = Buffer.from(base64Data, 'base64').toString('utf-8');
              console.log("📥 Datos recibidos:", decodedString);
              
              if (processReceivedData(decodedString)) {
                setConnectionError(""); // Limpiar error si los datos son válidos
              }
            } catch (decodeError) {
              console.log("❌ Error decodificando:", decodeError);
              setConnectionError("Error decodificando datos del sensor");
            }
          }
        }
      );

      // Manejar desconexión
      deviceInstance.onDisconnected(() => {
        console.log("📱 Dispositivo desconectado");
        handleDisconnection("El sensor se ha desconectado");
      });

    } catch (err) {
      console.log("❌ Error en conexión:", err);
      setStatus("Error al conectar");
      setConnectionError(err.message || "No se pudo conectar al sensor");
      setIsConnected(false);
      setCurrentDevice(null);
    }
  };

  // ✅ Procesar datos recibidos (sin cambios)
  const processReceivedData = (data) => {
    try {
      console.log("📥 Datos recibidos:", data);
      
      bufferRef.current = data;
      const trimmedData = data.trim();
      if (trimmedData.length === 0) return false;

      try {
        const sensorData = JSON.parse(trimmedData);
        console.log("✅ JSON parseado correctamente:", sensorData);
        
        if (sensorData.m !== undefined) {
          const moistureValue = sensorData.m;
          setHumidity(moistureValue);
          setLastUpdate(new Date());
          setStatus(`Conectado - Humedad: ${moistureValue}%`);
          return true;
        }
      } catch (jsonError) {
        const moistureMatch = trimmedData.match(/"m":\s*(\d+)/);
        if (moistureMatch) {
          const moistureValue = parseInt(moistureMatch[1]);
          setHumidity(moistureValue);
          setLastUpdate(new Date());
          setStatus(`Conectado - Humedad: ${moistureValue}%`);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.log("❌ Error procesando datos:", error);
      return false;
    }
  };

  // ✅ Manejar desconexión
  const handleDisconnection = (message = "Desconectado") => {
    setIsConnected(false);
    setCurrentDevice(null);
    setStatus(message);
    setConnectionError(message);
    setHumidity(null);
    bufferRef.current = "";
  };

  // ✅ Desconectar dispositivo
  const disconnectDevice = async () => {
    try {
      console.log("🛑 Iniciando desconexión...");
      
      stopScan();
      
      if (currentDevice) {
        try {
          await currentDevice.cancelConnection();
          console.log("✅ Dispositivo desconectado");
        } catch (disconnectError) {
          console.log("⚠️ Error en desconexión:", disconnectError);
        }
      }
      
      handleDisconnection("Desconectado manualmente");
      
    } catch (error) {
      console.log("❌ Error en desconexión:", error);
      setStatus("Error al desconectar");
    }
  };

  // ✅ Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      managerRef.current.stopDeviceScan();
    };
  }, []);

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