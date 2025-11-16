// contexts/BleContext.js - VERSIÓN CORREGIDA
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Platform, PermissionsAndroid, NativeEventEmitter, NativeModules } from 'react-native';
import { Buffer } from 'buffer';

const BleManager = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManager);

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

const BleContext = createContext();

export const useBle = () => {
  const context = useContext(BleContext);
  if (!context) throw new Error('useBle debe estar dentro de BleProvider');
  return context;
};

export const BleProvider = ({ children }) => {
  const [humidity, setHumidity] = useState(null);
  const [status, setStatus] = useState("Desconectado");
  const [isConnected, setIsConnected] = useState(false);
  const [humidityHistory, setHumidityHistory] = useState([]);
  const [deviceName, setDeviceName] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [devicesList, setDevicesList] = useState([]);
  const [bluetoothState, setBluetoothState] = useState("Unknown");

  // Referencias
  const isMountedRef = useRef(true);
  const connectedDeviceIdRef = useRef(null);
  const scanTimeoutRef = useRef(null);
  const readIntervalRef = useRef(null);
  const eventSubscriptionsRef = useRef([]);

  // Inicializar BLE Manager
  useEffect(() => {
    isMountedRef.current = true;
    console.log('🚀 BleProvider iniciado con BleManager v12.4.1');

    const initBleManager = async () => {
      try {
        await BleManager.start({ showAlert: false });
        console.log('✅ BleManager inicializado');
        
        setupEventListeners();
        checkBluetoothState();
        
      } catch (error) {
        console.log('❌ Error inicializando BleManager:', error);
      }
    };

    initBleManager();

    return () => {
      console.log('🧹 BleProvider desmontándose...');
      isMountedRef.current = false;
      cleanup();
    };
  }, []);

  const safeUpdate = (updater) => {
    if (isMountedRef.current) {
      try {
        updater();
      } catch (error) {
        console.log('⚠️ Error en safeUpdate:', error.message);
      }
    }
  };

  const cleanup = () => {
    console.log('🛡️ Ejecutando cleanup');
    
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    
    if (readIntervalRef.current) {
      clearInterval(readIntervalRef.current);
      readIntervalRef.current = null;
    }
    
    eventSubscriptionsRef.current.forEach(subscription => {
      try {
        subscription.remove();
      } catch (e) {}
    });
    eventSubscriptionsRef.current = [];
    
    if (connectedDeviceIdRef.current) {
      BleManager.disconnect(connectedDeviceIdRef.current).catch(() => {});
      connectedDeviceIdRef.current = null;
    }
    
    try {
      BleManager.stopScan();
    } catch (error) {}
  };

  const setupEventListeners = () => {
    const disconnectSubscription = bleManagerEmitter.addListener(
      'BleManagerDisconnectPeripheral',
      handleDisconnection
    );

    const stateSubscription = bleManagerEmitter.addListener(
      'BleManagerDidUpdateState',
      handleBluetoothStateChange
    );

    eventSubscriptionsRef.current = [disconnectSubscription, stateSubscription];
  };

  const handleDisconnection = (data) => {
    console.log('📱 Dispositivo desconectado:', data);
    safeUpdate(() => {
      setIsConnected(false);
      setStatus("Desconectado");
      setHumidity(null);
      setConnectionError("Sensor desconectado");
    });
    connectedDeviceIdRef.current = null;
    
    if (readIntervalRef.current) {
      clearInterval(readIntervalRef.current);
      readIntervalRef.current = null;
    }
  };

  const handleBluetoothStateChange = (state) => {
    console.log('📲 Estado Bluetooth cambiado:', state);
    safeUpdate(() => {
      setBluetoothState(state);
      
      if (state === 'off') {
        setConnectionError("Bluetooth apagado");
        setStatus("Bluetooth apagado");
        setIsConnected(false);
        setHumidity(null);
        cleanup();
      } else if (state === 'on') {
        setConnectionError("");
      }
    });
  };

  const checkBluetoothState = async () => {
    try {
      const state = await BleManager.checkState();
      safeUpdate(() => setBluetoothState(state));
    } catch (error) {
      console.log('❌ Error checkBluetoothState:', error);
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS !== 'android') return true;

    try {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        
        return Object.values(granted).every(
          permission => permission === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (error) {
      console.log('❌ Error en permisos:', error);
      return false;
    }
  };

  // ✅ SCAN CORREGIDO - VERSIÓN COMPATIBLE CON v12.4.1
  const scanForDevices = async () => {
    if (!isMountedRef.current) return;

    console.log('🔍 Iniciando escaneo...');

    const hasPermissions = await requestPermissions();
    if (!hasPermissions) {
      safeUpdate(() => setConnectionError("Permisos de Bluetooth denegados"));
      return;
    }

    safeUpdate(() => {
      setDevicesList([]);
      setIsScanning(true);
      setStatus("Buscando sensores...");
      setConnectionError("");
    });

    cleanup();

    try {
      // ✅ SOLUCIÓN: Usar la firma correcta para v12.4.1
      // En v12.4.1, scan() no acepta argumentos o acepta un array de servicios
      console.log('🔄 Usando scan sin argumentos (v12.4.1)...');
      
      // Primero intentar sin argumentos
      await new Promise((resolve, reject) => {
        BleManager.scan()
          .then(resolve)
          .catch(error => {
            console.log('❌ Scan sin argumentos falló:', error.message);
            // Intentar con array de servicios vacío
            BleManager.scan([])
              .then(resolve)
              .catch(error2 => {
                console.log('❌ Scan con array vacío falló:', error2.message);
                // Último intento: con servicios específicos
                BleManager.scan([SERVICE_UUID])
                  .then(resolve)
                  .catch(reject);
              });
          });
      });

      console.log('✅ Escaneo iniciado correctamente');

      const discoverySubscription = bleManagerEmitter.addListener(
        'BleManagerDiscoverPeripheral',
        (device) => {
          if (!isMountedRef.current) return;

          if (device.name) {
            const name = device.name.toLowerCase();
            if (name.includes("esp32") || name.includes("sensor") || name.includes("humedad")) {
              console.log('📱 Dispositivo encontrado:', device.name, device.id);
              safeUpdate(() => {
                setDevicesList(prev => {
                  const exists = prev.some(d => d.id === device.id);
                  if (!exists) {
                    return [...prev, { 
                      id: device.id, 
                      name: device.name, 
                      device: device 
                    }];
                  }
                  return prev;
                });
              });
            }
          }
        }
      );

      eventSubscriptionsRef.current.push(discoverySubscription);

      scanTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Timeout de escaneo');
        stopScan();
        safeUpdate(() => setStatus("Escaneo completado"));
      }, 10000);

    } catch (error) {
      console.log('❌ Error en escaneo:', error);
      safeUpdate(() => {
        setIsScanning(false);
        setStatus("Error en escaneo");
        setConnectionError("Error en escaneo: " + error.message);
      });
    }
  };

  const stopScan = () => {
    console.log('⏹️ Deteniendo escaneo');
    try {
      BleManager.stopScan();
    } catch (error) {
      console.log('⚠️ Error al detener escaneo:', error);
    }
    cleanup();
    safeUpdate(() => {
      setIsScanning(false);
      setStatus("Escaneo detenido");
    });
  };

  // ... (resto del código se mantiene igual)
  const connectToDevice = async (deviceData) => {
    if (!isMountedRef.current) return;

    console.log('🔗 Conectando a dispositivo:', deviceData);
    
    safeUpdate(() => {
      setConnectionError("");
      setStatus("Conectando...");
      setIsScanning(false);
    });

    cleanup();

    try {
      const deviceId = deviceData.id;
      
      if (!deviceId) {
        throw new Error("ID del dispositivo no disponible");
      }

      console.log('📲 Conectando a ID:', deviceId);
      
      await BleManager.connect(deviceId);
      console.log('✅ Dispositivo conectado');

      await new Promise(resolve => setTimeout(resolve, 500));
      
      await BleManager.retrieveServices(deviceId);
      console.log('✅ Servicios descubiertos');

      connectedDeviceIdRef.current = deviceId;
      
      safeUpdate(() => {
        setDeviceName(deviceData.name || "ESP32-Sensor");
        setIsConnected(true);
        setStatus("Conectado");
        setConnectionError("");
      });

      startReadingCharacteristic(deviceId);

    } catch (error) {
      console.log('❌ Error en conexión:', error);
      safeUpdate(() => {
        setConnectionError("Error al conectar: " + (error.message || "Desconocido"));
        setStatus("Error de conexión");
        setIsConnected(false);
      });
      cleanup();
    }
  };

  const startReadingCharacteristic = (deviceId) => {
    readCharacteristic(deviceId);
    
    readIntervalRef.current = setInterval(() => {
      if (isMountedRef.current && connectedDeviceIdRef.current === deviceId) {
        readCharacteristic(deviceId);
      }
    }, 2000);
  };

  const readCharacteristic = async (deviceId) => {
    try {
      console.log('📖 Leyendo característica...');
      const data = await BleManager.read(
        deviceId,
        SERVICE_UUID,
        CHARACTERISTIC_UUID
      );
      
      console.log('📊 Datos recibidos:', data);
      
      if (data) {
        processData(data);
      }
    } catch (error) {
      console.log('❌ Error leyendo característica:', error.message);
      if (error.message?.includes('Device not connected') || 
          error.message?.includes('disconnected')) {
        console.log('📱 Dispositivo desconectado durante lectura');
        handleDisconnection();
      }
    }
  };

  const processData = (base64Value) => {
    if (!isMountedRef.current || !base64Value) return;

    try {
      console.log('🔄 Procesando datos base64:', base64Value);
      
      const rawData = Buffer.from(base64Value, 'base64').toString('utf-8').trim();
      console.log('📝 Datos crudos:', rawData);
      
      let value = null;
      
      try {
        const jsonData = JSON.parse(rawData);
        value = jsonData.m ?? jsonData.humedad ?? null;
        console.log('📋 Datos JSON parseados:', jsonData);
      } catch (jsonError) {
        console.log('📋 No es JSON, intentando parsear como número');
        value = parseFloat(rawData);
      }

      console.log('🔢 Valor extraído:', value);

      if (value !== null && !isNaN(value) && value >= 0 && value <= 100) {
        const roundedValue = Math.round(value);
        console.log('✅ Valor procesado:', roundedValue + '%');
        
        safeUpdate(() => {
          setHumidity(roundedValue);
          setLastUpdate(new Date());
          setStatus(`Conectado - ${roundedValue}%`);
        });

        setHumidityHistory(prev => {
          const newHistory = [...prev, { 
            value: roundedValue, 
            timestamp: new Date().toISOString() 
          }];
          return newHistory.slice(-10);
        });
      } else {
        console.log('❌ Valor inválido:', value);
      }
    } catch (error) {
      console.log('❌ Error procesando datos:', error);
    }
  };

  const disconnectDevice = async () => {
    console.log('🛑 Desconexión manual');
    
    safeUpdate(() => {
      setStatus("Desconectando...");
    });

    if (connectedDeviceIdRef.current) {
      try {
        await BleManager.disconnect(connectedDeviceIdRef.current);
        console.log('✅ Dispositivo desconectado');
      } catch (error) {
        console.log('⚠️ Error en desconexión:', error);
      }
    }

    cleanup();
    
    safeUpdate(() => {
      setIsConnected(false);
      setStatus("Desconectado");
      setHumidity(null);
      setDeviceName("");
    });
  };

  return (
    <BleContext.Provider
      value={{
        humidity,
        status,
        isConnected,
        deviceName,
        connectionError,
        lastUpdate,
        isScanning,
        devicesList,
        humidityHistory,
        bluetoothState,
        connectToDevice,
        disconnectDevice,
        scanForDevices,
        stopScan,
      }}
    >
      {children}
    </BleContext.Provider>
  );
};